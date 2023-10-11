import {
  FindAddressPointsType,
  checkStreetExists,
  findAddressPoints,
  getAddressPointById,
} from "../db/address-points";
import { disconnectKnex } from "../db/db";
import { findFounder } from "../db/founders";
import { findSchool } from "../db/schools";
import { Founder, founderToMunicipality } from "../db/types";
import {
  getMunicipalityPartResult,
  getSwitchMunicipality,
  getWholeMunicipality,
  isMunicipalitySwitch,
  isNoStreetNameLine,
  isWholeMunicipality,
} from "./municipality";
import { parseLine } from "./smd-line-parser";
import {
  AddressPoint,
  ErrorCallbackParams,
  ExportAddressPoint,
  Municipality,
  MunicipalityWithFounder,
  ProcessLineCallbackParams,
  ProcessLineParams,
  School,
  SmdError,
  SmdState,
  isAddressPoint,
} from "./types";

export const parseOrdinanceToAddressPoints = async (
  lines: string[],
  initialState: Partial<SmdState> = {},
  onError: (params: ErrorCallbackParams) => void = () => {},
  onWarning: (params: ErrorCallbackParams) => void = () => {},
  onProcessedLine: (params: ProcessLineCallbackParams) => void = () => {}
) => {
  try {
    const state: SmdState = {
      currentMunicipality: null,
      currentFilterMunicipality: null,
      currentSchool: null,
      noStreetNameSchoolIzo: null,
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

    if (state.currentMunicipality != null) {
      if (state.noStreetNameSchoolIzo) {
        await addNoStreetNameToSchool(state);
      }
      state.municipalities.push(convertMunicipality(state.currentMunicipality));
    }

    return state.municipalities;
  } catch (error) {
    console.error(error);
  } finally {
    await disconnectKnex();
  }
};

const filterOutSchoolAddressPoint = (
  addressPoints: AddressPoint[],
  school: School
) => {
  const schoolPosition = school.position;
  return schoolPosition && isAddressPoint(schoolPosition)
    ? (addressPoints = addressPoints.filter(
        (ap) => ap.id !== schoolPosition.id
      ))
    : addressPoints;
};

export const convertMunicipality = (
  municipality: MunicipalityWithFounder
): Municipality => {
  return {
    municipalityName: municipality.municipalityName,
    schools: municipality.schools,
  };
};

const processOneLine = async (params: ProcessLineParams) => {
  const { line, state } = params;

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
  } else if (isNoStreetNameLine(line)) {
    state.noStreetNameSchoolIzo = state.currentSchool.izo;
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

  if (state.currentMunicipality !== null) {
    if (state.noStreetNameSchoolIzo) {
      await addNoStreetNameToSchool(state);
    }
    state.municipalities.push(convertMunicipality(state.currentMunicipality));
  }

  const { municipality, errors } = await getNewMunicipality(line);
  if (errors.length > 0) {
    onError({ lineNumber, line, errors });
  }
  state.currentMunicipality = municipality;
  state.currentFilterMunicipality = founderToMunicipality(
    state.currentMunicipality.founder
  );

  state.currentSchool = null;
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
    const addressPoints = await findAddressPoints({
      type: "wholeMunicipality",
      municipality,
    });
    state.currentSchool.addresses.push(
      ...filterOutSchoolAddressPoint(addressPoints, state.currentSchool).map(
        mapAddressPointForExport
      )
    );
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

          state.currentSchool.addresses.push(
            ...filterOutSchoolAddressPoint(
              addressPoints,
              state.currentSchool
            ).map(mapAddressPointForExport)
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

          state.currentSchool.addresses.push(
            ...filterOutSchoolAddressPoint(
              addressPoints,
              state.currentSchool
            ).map(mapAddressPointForExport)
          );
        }
      }
    }
  }
};

const addNoStreetNameToSchool = async (state: SmdState) => {
  const addressPoints = state.currentMunicipality.schools.flatMap(
    (school) => school.addresses
  );

  // get all address points without street name for current municipality
  const pointsNoStreetName = await findAddressPoints({
    type: "wholeMunicipalityNoStreetName",
    municipality: {
      code: state.currentMunicipality.founder.cityOrDistrictCode,
      type: state.currentMunicipality.founder.municipalityType,
    },
  });

  // filter out address points already present
  const remainingPoints = pointsNoStreetName.filter(
    (point) => !addressPoints.some((ap) => ap.address === point.address)
  );

  // find the right school and add the remaining address points
  const schoolIndex = state.currentMunicipality.schools.findIndex(
    (school) => school.izo === state.noStreetNameSchoolIzo
  );

  state.currentMunicipality.schools[schoolIndex].addresses.push(
    ...remainingPoints
  );
  state.noStreetNameSchoolIzo = null;
};

export const getNewMunicipality = async (
  name: string
): Promise<{ municipality: MunicipalityWithFounder; errors: SmdError[] }> => {
  const { founder, errors } = await findFounder(name);
  return {
    municipality: {
      municipalityName: founder ? founder.name : "Neznámá obec",
      founder,
      schools: [],
    },
    errors,
  };
};

export const getNewSchool = async (
  name: string,
  founder: Founder | null,
  lineNumber: number,
  onError: (params: ErrorCallbackParams) => void
): Promise<School> => {
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
  return exportSchool;
};

const mapAddressPointForExport = (
  addressPoint: AddressPoint | ExportAddressPoint
): ExportAddressPoint => {
  return {
    address: addressPoint.address,
    lat: addressPoint.lat,
    lng: addressPoint.lng,
  };
};

const mapSchoolForExport = (school: School): School => ({
  name: school.name,
  izo: school.izo,
  addresses: school.addresses,
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
