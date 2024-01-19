import {
  checkStreetExists,
  findAddressPoints,
  getAddressPointById,
} from "../db/address-points";
import { disconnectKnex } from "../db/db";
import { findFounder, getFounderById } from "../db/founders";
import { findSchool } from "../db/schools";
import { Founder, MunicipalityType, founderToMunicipality } from "../db/types";
import {
  getMunicipalityPartResult,
  getRestOfMunicipalityPart,
  getSwitchMunicipality,
  getWholeMunicipality,
  isMunicipalitySwitch,
  isRestOfMunicipalityLine,
  isRestOfMunicipalityPartLine,
  isRestWithNoStreetNameLine,
  isWholeMunicipality,
} from "./municipality";
import { parseLine } from "./smd-line-parser";
import {
  AddressPoint,
  ErrorCallbackParams,
  ExportAddressPoint,
  IntermediateMunicipality,
  IntermediateSchool,
  Municipality,
  MunicipalityWithFounder,
  IntermediateMunicipalityResult,
  ProcessLineCallbackParams,
  ProcessLineParams,
  School,
  SmdError,
  SmdState,
  isAddressPoint,
} from "./types";

interface ParseOrdinanceProps {
  lines: string[];
  initialState?: Partial<SmdState>;
  onError?: (params: ErrorCallbackParams) => void;
  onWarning?: (params: ErrorCallbackParams) => void;
  onProcessedLine?: (params: ProcessLineCallbackParams) => void;
  includeUnmappedAddressPoints: boolean;
}

export const parseOrdinanceToAddressPoints = async ({
  lines,
  initialState = {},
  onError = () => {},
  onWarning = () => {},
  onProcessedLine = () => {},
  includeUnmappedAddressPoints = false,
}: ParseOrdinanceProps): Promise<Municipality[]> => {
  try {
    const state: SmdState = {
      currentMunicipality: null,
      currentFilterMunicipality: null,
      currentSchool: null,
      rests: {
        noStreetNameSchool: {
          izo: null,
          lineNumber: null,
        },
        municipalityParts: [],
        wholeMunicipalitySchool: {
          izo: null,
          lineNumber: null,
        },
        includeUnmappedAddressPoints,
      },
      cityCodes: [],
      municipalities: [],
      ...initialState,
    };

    let lineNumber = 1;

    for (const rawLine of lines) {
      const line = cleanLine(rawLine);
      await processOneLine({
        line,
        state,
        lineNumber,
        onError,
        onWarning,
      });
      onProcessedLine({ lineNumber, line });
      lineNumber++;
    }

    if (state.currentSchool != null) {
      if (state.currentMunicipality == null) {
        return [];
      }
      state.currentMunicipality.schools.push(
        mapSchoolForExport(state.currentSchool)
      );
    }

    await completeCurrentMunicipality(state);

    return state.municipalities;
  } catch (error) {
    console.error(error);
  } finally {
    await disconnectKnex();
  }
  return [];
};

export const convertMunicipality = (
  municipality: IntermediateMunicipality
): Municipality => {
  return {
    municipalityName: municipality.municipalityName,
    schools: municipality.schools.map((school) => {
      return {
        name: school.name,
        izo: school.izo,
        addresses: Array.from(school.addressMap.values()),
        position: school.position,
      };
    }),
    cityCodes: [...new Set(municipality.cityCodes)],
    districtCodes: [...new Set(municipality.districtCodes)],
    unmappedPoints: municipality.unmappedPoints,
  };
};

const processOneLine = async (params: ProcessLineParams) => {
  const { line, lineNumber, state } = params;

  if (line[0] === "#") {
    await processMunicipalityLine(params);
    return;
  }

  if (line === "") {
    // end of school
    processEmptyLine(params);
    return;
  }

  if (line[0] === "!") {
    return;
  }

  if (state.currentSchool === null) {
    await processSchoolLine(params);
    return;
  }

  if (isMunicipalitySwitch(line)) {
    processMunicipalitySwitchLine(params);
  } else if (isWholeMunicipality(line)) {
    await processWholeMunicipalityLine(params);
  } else if (isRestWithNoStreetNameLine(line)) {
    state.rests.noStreetNameSchool = {
      izo: state.currentSchool.izo,
      lineNumber,
    };
  } else if (isRestOfMunicipalityLine(line)) {
    state.rests.wholeMunicipalitySchool = {
      izo: state.currentSchool.izo,
      lineNumber,
    };
  } else if (isRestOfMunicipalityPartLine(line)) {
    const { municipalityPartCode, errors } = await getRestOfMunicipalityPart(
      line,
      state.currentMunicipality.founder
    );
    if (errors.length > 0) {
      params.onError({ lineNumber: lineNumber, line, errors });
    } else {
      state.rests.municipalityParts.push({
        municipalityPartCode,
        schoolIzo: state.currentSchool.izo,
        lineNumber: lineNumber,
      });
    }
  } else {
    await processAddressPointLine(params);
  }
};

const processMunicipalityLine = async ({
  line,
  lineNumber,
  state,
  onError,
}: ProcessLineParams) => {
  if (state.currentSchool !== null) {
    state.currentMunicipality.schools.push(state.currentSchool);
    state.currentSchool = null;
  }

  await completeCurrentMunicipality(state);

  const { municipality, errors } = await getNewMunicipalityByName(line);
  if (errors.length > 0) {
    onError({ lineNumber, line, errors });
  }
  state.currentMunicipality = municipality;
  state.currentFilterMunicipality = founderToMunicipality(
    state.currentMunicipality.founder
  );

  state.currentSchool = null;
};

const completeCurrentMunicipality = async (state: SmdState) => {
  if (state.currentMunicipality !== null) {
    await addRests(state);
    state.municipalities.push(convertMunicipality(state.currentMunicipality));
  }
};

const processEmptyLine = ({ state }: ProcessLineParams) => {
  if (state.currentSchool !== null) {
    state.currentMunicipality.schools.push(state.currentSchool);
    state.currentSchool = null;
  }
};

const processSchoolLine = async ({
  line,
  lineNumber,
  state,
  onError,
}: ProcessLineParams) => {
  if (state.currentMunicipality === null) {
    onError({
      lineNumber,
      line,
      errors: [
        wholeLineError(
          "Definici školy musí předcházet definice zřizovatele (uvozená '#', např. '# Strakonice').",
          line
        ),
      ],
    });
    return;
  }
  state.currentSchool = await getNewSchool(
    line,
    state.currentMunicipality.founder,
    lineNumber,
    onError
  );
  state.currentFilterMunicipality = founderToMunicipality(
    state.currentMunicipality.founder
  );
};

const processMunicipalitySwitchLine = async ({
  line,
  state,
  lineNumber,
  onError,
}: ProcessLineParams) => {
  const { municipality, errors } = await getSwitchMunicipality(
    line,
    state.currentMunicipality.founder
  );
  if (errors.length > 0) {
    onError({ lineNumber, line, errors });
  } else {
    if (municipality.type === MunicipalityType.City) {
      state.currentMunicipality.cityCodes.push(municipality.code);
    } else {
      state.currentMunicipality.districtCodes.push(municipality.code);
    }
    state.currentFilterMunicipality = municipality;
  }
};

const processWholeMunicipalityLine = async ({
  line,
  state,
  lineNumber,
  onError,
}: ProcessLineParams) => {
  const { municipality, errors } = await getWholeMunicipality(
    line,
    state.currentMunicipality.founder
  );
  if (errors.length > 0) {
    onError({ lineNumber, line, errors });
  } else {
    if (municipality.type === MunicipalityType.City) {
      state.currentMunicipality.cityCodes.push(municipality.code);
    } else {
      state.currentMunicipality.districtCodes.push(municipality.code);
    }
    const addressPoints = await findAddressPoints({
      type: "wholeMunicipality",
      municipality,
    });
    addAddressPointsToSchool(state.currentSchool, addressPoints, lineNumber);
  }
};

const addAddressPointsToSchool = (
  school: IntermediateSchool,
  addressPoints: AddressPoint[],
  lineNumber: number
) => {
  for (const point of addressPoints) {
    if (school.addressMap.has(point.id)) {
      school.addressMap.get(point.id).lineNumbers.push(lineNumber - 1);
    } else {
      school.addressMap.set(
        point.id,
        mapAddressPointForExport(point, lineNumber)
      );
    }
  }
};

const processAddressPointLine = async ({
  line,
  state,
  lineNumber,
  onError,
  onWarning,
}: ProcessLineParams) => {
  const { smdLines, errors } = parseLine(line);
  if (errors.length > 0) {
    onError({ lineNumber, line, errors });
  } else {
    for (const smdLine of smdLines) {
      if (smdLine.type === "street") {
        const { exists, errors } = await checkStreetExists(
          smdLine.street,
          state.currentMunicipality.founder
        );
        if (errors.length > 0) {
          onWarning({ lineNumber, line, errors });
        }
        if (exists) {
          const addressPoints = await findAddressPoints({
            type: "smdLine",
            smdLine,
            municipality: state.currentFilterMunicipality,
          });

          addAddressPointsToSchool(
            state.currentSchool,
            addressPoints,
            lineNumber
          );
        }
      } else if (smdLine.type === "municipalityPart") {
        const { municipalityPartCode, errors } =
          await getMunicipalityPartResult(
            smdLine.municipalityPart,
            line,
            state.currentMunicipality.founder
          );
        if (errors.length > 0) {
          onWarning({ lineNumber, line, errors });
        } else {
          const addressPoints = await findAddressPoints({
            type: "smdLine",
            smdLine,
            municipality: state.currentFilterMunicipality,
            municipalityPartCode,
          });

          addAddressPointsToSchool(
            state.currentSchool,
            addressPoints,
            lineNumber
          );
        }
      }
    }
  }
};

const addRestToSchool = (
  restPoints: AddressPoint[],
  schoolIzo: string,
  lineNumber: number,
  state: SmdState
) => {
  const addressPointsIds = getAllAddressPointsIds(state.currentMunicipality);

  // filter out address points already present
  const remainingPoints = restPoints.filter(
    (point) => !addressPointsIds.has(point.id)
  );

  // find the right school and add the remaining address points
  const schoolIndex = state.currentMunicipality.schools.findIndex(
    (school) => school.izo === schoolIzo
  );

  addAddressPointsToSchool(
    state.currentMunicipality.schools[schoolIndex],
    remainingPoints,
    lineNumber
  );
};

const addRests = async (state: SmdState) => {
  if (state.rests.noStreetNameSchool.izo) {
    await addRestWithNoStreetNameToSchool(
      state.rests.noStreetNameSchool.lineNumber,
      state
    );
  }

  if (state.rests.wholeMunicipalitySchool.izo) {
    await addRestOfMunicipality(
      state.rests.wholeMunicipalitySchool.lineNumber,
      state
    );
  }

  for (const rest of state.rests.municipalityParts) {
    await addRestOfMunicipalityPart(
      state,
      rest.municipalityPartCode,
      rest.schoolIzo,
      rest.lineNumber
    );
  }

  if (state.rests.includeUnmappedAddressPoints) {
    await addRestOfMunicipalityToUnmappedPoints(state);
  }

  state.rests.noStreetNameSchool.izo = null;
  state.rests.wholeMunicipalitySchool.izo = null;
  state.rests.municipalityParts = [];
};

const addRestWithNoStreetNameToSchool = async (
  lineNumber: number,
  state: SmdState
) => {
  // get all address points without street name for current municipality
  const pointsNoStreetName = await findAddressPoints({
    type: "wholeMunicipalityNoStreetName",
    municipality: {
      code: state.currentMunicipality.founder.cityOrDistrictCode,
      type: state.currentMunicipality.founder.municipalityType,
    },
  });
  addRestToSchool(
    pointsNoStreetName,
    state.rests.noStreetNameSchool.izo,
    lineNumber,
    state
  );
};

const addRestOfMunicipality = async (lineNumber: number, state: SmdState) => {
  addRestToSchool(
    await getRestOfMunicipality(state),
    state.rests.wholeMunicipalitySchool.izo,
    lineNumber,
    state
  );
};

const addRestOfMunicipalityToUnmappedPoints = async (state: SmdState) => {
  state.currentMunicipality.unmappedPoints = (
    await getRestOfMunicipality(state)
  ).map(mapAddressPointForExport);
};

const getRestOfMunicipality = async (
  state: SmdState
): Promise<AddressPoint[]> => {
  // get all address points for current municipality
  const allPoints = await findAddressPoints({
    type: "wholeMunicipality",
    municipality: {
      code: state.currentMunicipality.founder.cityOrDistrictCode,
      type: state.currentMunicipality.founder.municipalityType,
    },
  });

  // filter out address points already present
  const addressPointsIds = getAllAddressPointsIds(state.currentMunicipality);
  return allPoints.filter((point) => !addressPointsIds.has(point.id));
};

const addRestOfMunicipalityPart = async (
  state: SmdState,
  municipalityPartCode: number,
  schoolIzo: string,
  lineNumber: number
) => {
  // get all address points for current municipality
  const allPoints = await findAddressPoints({
    type: "wholeMunicipalityPart",
    municipalityPartCode,
  });
  addRestToSchool(allPoints, schoolIzo, lineNumber, state);
};

export const getNewMunicipalityByName = async (
  name: string
): Promise<IntermediateMunicipalityResult> => {
  const { founder, errors } = await findFounder(name);
  return getNewMunicipality(founder, errors);
};

export const getNewMunicipalityByFounderId = async (
  founderId: number
): Promise<IntermediateMunicipalityResult> => {
  const { founder, errors } = await getFounderById(founderId);
  return getNewMunicipality(founder, errors);
};

const getNewMunicipality = (
  founder: Founder,
  errors: SmdError[]
): IntermediateMunicipalityResult => ({
  municipality: {
    municipalityName: founder ? founder.name : "Neznámá obec",
    founder,
    schools: [],
    cityCodes:
      founder.municipalityType === MunicipalityType.City
        ? [founder.cityOrDistrictCode]
        : [],
    districtCodes:
      founder.municipalityType === MunicipalityType.District
        ? [founder.cityOrDistrictCode]
        : [],
    unmappedPoints: [],
  },
  errors,
});

export const getNewSchool = async (
  name: string,
  founder: Founder | null,
  lineNumber: number,
  onError: (params: ErrorCallbackParams) => void
): Promise<IntermediateSchool> => {
  let exportSchool: School = {
    name,
    izo: "",
    addresses: [],
  };
  if (founder !== null) {
    const { school, errors } = findSchool(name, founder.schools);
    if (errors.length > 0) {
      onError({ lineNumber, line: name, errors });
    }
    if (school) {
      exportSchool.name = school.name;
      exportSchool.izo = school.izo || "";
      if (school.locations.length > 0) {
        const position = await getAddressPointById(
          school.locations[0].addressPointId
        );
        if (position !== null) {
          exportSchool.position = position;
        }
      }
    }
  }
  return { ...exportSchool, addressMap: new Map<number, ExportAddressPoint>() };
};

const getAllAddressPointsIds = (
  municipality: IntermediateMunicipality
): Set<number> => {
  const addressPointsIds = new Set<number>();

  for (const school of municipality.schools) {
    for (const id of school.addressMap.keys()) {
      addressPointsIds.add(id);
    }
  }
  return addressPointsIds;
};

const mapAddressPointForExport = (
  addressPoint: AddressPoint | ExportAddressPoint,
  lineNumber?: number
): ExportAddressPoint => {
  return {
    address: addressPoint.address,
    lat: addressPoint.lat,
    lng: addressPoint.lng,
    ...(lineNumber ? { lineNumbers: [lineNumber - 1] } : {}),
  };
};

const mapSchoolForExport = (
  school: IntermediateSchool
): IntermediateSchool => ({
  ...school,
  position: school.position ? mapAddressPointForExport(school.position) : null,
});

const cleanLine = (line: string) => {
  return line.trim().replace(/–/g, "-");
};

export const wholeLineError = (message: string, line: string): SmdError => ({
  message,
  startOffset: 0,
  endOffset: line.length + 1,
});
