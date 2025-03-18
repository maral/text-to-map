import {
  checkStreetExists,
  findAddressPoints,
  getAddressPointById,
} from "../db/address-points";
import { disconnectKnex } from "../db/db";
import { findFounder, getFounderById } from "../db/founders";
import { findSchool } from "../db/schools";
import {
  Founder,
  MunicipalityType,
  SchoolType,
  founderToMunicipality,
} from "../db/types";
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
  IntermediateArea,
  IntermediateMunicipality,
  IntermediateMunicipalityResult,
  IntermediateSchool,
  Municipality,
  ProcessLineCallbackParams,
  ProcessLineParams,
  School,
  SmdError,
  SmdState,
} from "./types";

interface ParseOrdinanceProps {
  lines: string[];
  initialState?: Partial<SmdState>;
  onError?: (params: ErrorCallbackParams) => void;
  onWarning?: (params: ErrorCallbackParams) => void;
  onProcessedLine?: (params: ProcessLineCallbackParams) => void;
  includeUnmappedAddressPoints: boolean;
  schoolType: SchoolType;
}

export const parseOrdinanceToAddressPoints = async ({
  lines,
  initialState = {},
  onError = () => {},
  onWarning = () => {},
  onProcessedLine = () => {},
  includeUnmappedAddressPoints = false,
  schoolType,
}: ParseOrdinanceProps): Promise<Municipality[]> => {
  try {
    const state: SmdState = {
      currentMunicipality: null,
      currentFilterMunicipality: null,
      currentArea: null,
      schoolsCompleted: false,
      areaCount: 0,
      rests: {
        noStreetNameArea: {
          areaIndex: null,
          lineNumber: null,
        },
        municipalityParts: [],
        wholeMunicipalityArea: {
          areaIndex: null,
          lineNumber: null,
        },
        includeUnmappedAddressPoints,
      },
      municipalities: [],
      ...initialState,
    };

    let lineNumber = 1;

    for (const rawLine of lines) {
      const line = cleanLine(rawLine);
      await processOneLine({
        line,
        rawLine: rawLine.trim(),
        state,
        lineNumber,
        onError,
        onWarning,
        schoolType,
      });
      onProcessedLine({ lineNumber, line });
      lineNumber++;
    }

    if (state.currentArea != null) {
      if (state.currentMunicipality == null) {
        return [];
      }
      state.currentMunicipality.areas.push(mapAreaForExport(state.currentArea));
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
    areas: municipality.areas.map((area) => ({
      index: area.index,
      schools: area.schools,
      addresses: Array.from(area.addressMap.values()).filter(
        (point) => point.lat !== 0 && point.lng !== 0
      ),
    })),
    code: municipality.founder.municipalityCode,
    municipalityType:
      municipality.founder.municipalityType === MunicipalityType.City
        ? "city"
        : "district",
    cityCodes: [...new Set(municipality.cityCodes)],
    districtCodes: [...new Set(municipality.districtCodes)],
    unmappedPoints: municipality.unmappedPoints.filter(
      (point) => point.lat !== 0 && point.lng !== 0
    ),
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

  if (state.currentArea === null) {
    await processFirstSchoolLine(params);
    return;
  }

  if (state.schoolsCompleted === false) {
    const foundNextSchool = await processNextSchoolLine(params);
    if (foundNextSchool) {
      return;
    } else {
      state.schoolsCompleted = true;
    }
  }

  if (isMunicipalitySwitch(line)) {
    processMunicipalitySwitchLine(params);
  } else if (isWholeMunicipality(line)) {
    await processWholeMunicipalityLine(params);
  } else if (isRestWithNoStreetNameLine(line)) {
    state.rests.noStreetNameArea = {
      areaIndex: state.currentArea.index,
      lineNumber,
    };
  } else if (isRestOfMunicipalityLine(line)) {
    state.rests.wholeMunicipalityArea = {
      areaIndex: state.currentArea.index,
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
        areaIndex: state.currentArea.index,
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
  schoolType,
  onError,
}: ProcessLineParams) => {
  if (state.currentArea !== null) {
    state.currentMunicipality.areas.push(state.currentArea);
  }

  await completeCurrentMunicipality(state);

  const { municipality, errors } = await getNewMunicipalityByName(
    line,
    schoolType
  );
  if (errors.length > 0) {
    onError({ lineNumber, line, errors });
  }
  state.currentMunicipality = municipality;
  state.currentFilterMunicipality = founderToMunicipality(
    state.currentMunicipality.founder
  );

  state.currentArea = null;
};

const completeCurrentMunicipality = async (state: SmdState) => {
  if (state.currentMunicipality !== null) {
    await addRests(state);
    state.municipalities.push(convertMunicipality(state.currentMunicipality));
  }
};

const processEmptyLine = ({ state }: ProcessLineParams) => {
  if (state.currentArea !== null) {
    state.currentMunicipality.areas.push(state.currentArea);
    state.currentArea = null;
  }
};

const processFirstSchoolLine = async ({
  rawLine,
  lineNumber,
  state,
  onError,
}: ProcessLineParams) => {
  if (state.currentMunicipality === null) {
    onError({
      lineNumber,
      line: rawLine,
      errors: [
        wholeLineError(
          "Definici školy musí předcházet definice zřizovatele (uvozená '#', např. '# Strakonice').",
          rawLine
        ),
      ],
    });
    return;
  }
  state.currentArea = {
    index: state.areaCount++,
    schools: [
      await getNewSchool({
        name: rawLine,
        founder: state.currentMunicipality.founder,
        lineNumber,
        required: true,
        onError,
      }),
    ],
    addresses: [],
    addressMap: new Map<number, ExportAddressPoint>(),
    allSchoolsAdded: false,
  };
  state.schoolsCompleted = false;
  state.currentFilterMunicipality = founderToMunicipality(
    state.currentMunicipality.founder
  );
};

const processNextSchoolLine = async ({
  line,
  lineNumber,
  state,
}: ProcessLineParams): Promise<boolean> => {
  const school = await getNewSchool({
    name: line,
    founder: state.currentMunicipality.founder,
    lineNumber,
    required: false,
    onError: () => {},
  });

  if (school === null) {
    return false;
  }

  state.currentArea.schools.push(school);
  return true;
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
    addAddressPointsToArea(state.currentArea, addressPoints, lineNumber);
  }
};

const addAddressPointsToArea = (
  area: IntermediateArea,
  addressPoints: AddressPoint[],
  lineNumber: number,
  municipalityCode?: number
) => {
  for (const point of addressPoints) {
    if (area.addressMap.has(point.id)) {
      area.addressMap.get(point.id).lineNumbers.push(lineNumber - 1);
    } else {
      area.addressMap.set(
        point.id,
        mapAddressPointForExport(point, lineNumber, municipalityCode)
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

          addAddressPointsToArea(
            state.currentArea,
            addressPoints,
            lineNumber,
            state.currentMunicipality.code !==
              state.currentFilterMunicipality.code
              ? state.currentFilterMunicipality.code
              : undefined
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

          addAddressPointsToArea(state.currentArea, addressPoints, lineNumber);
        }
      }
    }
  }
};

const addRestToArea = (
  restPoints: AddressPoint[],
  areaIndex: number,
  lineNumber: number,
  state: SmdState
) => {
  const addressPointsIds = getAllAddressPointsIds(state.currentMunicipality);

  // filter out address points already present
  const remainingPoints = restPoints.filter(
    (point) => !addressPointsIds.has(point.id)
  );

  addAddressPointsToArea(
    state.currentMunicipality.areas.find((area) => area.index === areaIndex),
    remainingPoints,
    lineNumber
  );
};

const addRests = async (state: SmdState) => {
  if (state.rests.noStreetNameArea.areaIndex !== null) {
    await addRestWithNoStreetNameToSchool(
      state.rests.noStreetNameArea.lineNumber,
      state
    );
  }

  if (state.rests.wholeMunicipalityArea.areaIndex !== null) {
    await addRestOfMunicipality(
      state.rests.wholeMunicipalityArea.lineNumber,
      state
    );
  }

  for (const rest of state.rests.municipalityParts) {
    await addRestOfMunicipalityPart(
      state,
      rest.municipalityPartCode,
      rest.areaIndex,
      rest.lineNumber
    );
  }

  if (state.rests.includeUnmappedAddressPoints) {
    await addRestOfMunicipalityToUnmappedPoints(state);
  }

  state.rests.noStreetNameArea.areaIndex = null;
  state.rests.wholeMunicipalityArea.areaIndex = null;
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
      code: state.currentMunicipality.founder.municipalityCode,
      type: state.currentMunicipality.founder.municipalityType,
    },
  });
  addRestToArea(
    pointsNoStreetName,
    state.rests.noStreetNameArea.areaIndex,
    lineNumber,
    state
  );
};

const addRestOfMunicipality = async (lineNumber: number, state: SmdState) => {
  addRestToArea(
    await getRestOfMunicipality(state),
    state.rests.wholeMunicipalityArea.areaIndex,
    lineNumber,
    state
  );
};

const addRestOfMunicipalityToUnmappedPoints = async (state: SmdState) => {
  state.currentMunicipality.unmappedPoints = (
    await getRestOfMunicipality(state)
  ).map((point) => mapAddressPointForExport(point));
};

const getRestOfMunicipality = async (
  state: SmdState
): Promise<AddressPoint[]> => {
  // get all address points for current municipality
  const allPoints = await findAddressPoints({
    type: "wholeMunicipality",
    municipality: {
      code: state.currentMunicipality.founder.municipalityCode,
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
  areaIndex: number,
  lineNumber: number
) => {
  const allPoints = await findAddressPoints({
    type: "wholeMunicipalityPart",
    municipalityPartCode,
  });
  addRestToArea(allPoints, areaIndex, lineNumber, state);
};

export const getNewMunicipalityByName = async (
  name: string,
  schoolType: SchoolType
): Promise<IntermediateMunicipalityResult> => {
  const { founder, errors } = await findFounder(name, schoolType);
  return getNewMunicipality(founder, errors);
};

export const getNewMunicipalityByFounderId = async (
  founderId: number,
  schoolType: SchoolType
): Promise<IntermediateMunicipalityResult> => {
  const { founder, errors } = await getFounderById(founderId, schoolType);
  return getNewMunicipality(founder, errors);
};

const getNewMunicipality = (
  founder: Founder,
  errors: SmdError[]
): IntermediateMunicipalityResult => ({
  municipality: {
    municipalityName: founder ? founder.name : "Neznámá obec",
    founder,
    areas: [],
    code: founder ? founder.municipalityCode : 0,
    municipalityType:
      founder.municipalityType === MunicipalityType.City ? "city" : "district",
    cityCodes:
      founder.municipalityType === MunicipalityType.City
        ? [founder.municipalityCode]
        : [],
    districtCodes:
      founder.municipalityType === MunicipalityType.District
        ? [founder.municipalityCode]
        : [],
    unmappedPoints: [],
  },
  errors,
});

export const getNewSchool = async ({
  name,
  founder,
  lineNumber,
  required,
  onError,
}: {
  name: string;
  founder: Founder | null;
  lineNumber: number;
  required: boolean;
  onError: (params: ErrorCallbackParams) => void;
}): Promise<IntermediateSchool | null> => {
  let exportSchool: School = {
    name,
    izo: "",
  };
  if (founder !== null) {
    const { school, errors } = findSchool(
      name,
      founder.schools,
      required ? undefined : 4
    );
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
          exportSchool.position = mapAddressPointForExport(position);
        }
      }
    } else {
      return null;
    }
  }
  return { ...exportSchool, addressMap: new Map<number, ExportAddressPoint>() };
};

const getAllAddressPointsIds = (
  municipality: IntermediateMunicipality
): Set<number> => {
  const addressPointsIds = new Set<number>();

  for (const area of municipality.areas) {
    for (const id of area.addressMap.keys()) {
      addressPointsIds.add(id);
    }
  }
  return addressPointsIds;
};

const mapAddressPointForExport = (
  addressPoint: AddressPoint | ExportAddressPoint,
  lineNumber?: number,
  municipalityCode?: number
): ExportAddressPoint => {
  return {
    address: addressPoint.address,
    lat: roundToNDecimalPlaces(addressPoint.lat, 6),
    lng: roundToNDecimalPlaces(addressPoint.lng, 6),
    ...(lineNumber !== undefined ? { lineNumbers: [lineNumber - 1] } : {}),
    ...(municipalityCode !== undefined ? { municipalityCode } : {}),
  };
};

const mapAreaForExport = (area: IntermediateArea): IntermediateArea => ({
  ...area,
  schools: area.schools.map((school) => ({
    ...school,
    position: school.position
      ? mapAddressPointForExport(school.position)
      : null,
  })),
});

const cleanLine = (line: string) => {
  return line.trim().replace(/–/g, "-");
};

export const wholeLineError = (message: string, line: string): SmdError => ({
  message,
  startOffset: 0,
  endOffset: line.length + 1,
});

const roundToNDecimalPlaces = (
  toRound: number,
  decimalPlaces: number
): number => {
  return (
    Math.round(toRound * Math.pow(10, decimalPlaces)) /
    Math.pow(10, decimalPlaces)
  );
};
