import {
  checkStreetExists,
  findAddressPoints,
  getAddressPointById,
} from "../db/address-points";
import { setDbConfig } from "../db/db";
import { findFounder } from "../db/founders";
import { findSchool } from "../db/schools";
import { Founder, founderToMunicipality } from "../db/types";
import { OpenDataSyncOptionsPartial, prepareOptions } from "../utils/helpers";
import {
  getSwitchMunicipality,
  getWholeMunicipality,
  isMunicipalitySwitch,
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
  SmdState,
  isAddressPoint,
} from "./types";

export const parseOrdinanceToAddressPoints = (
  lines: string[],
  options: OpenDataSyncOptionsPartial = {},
  initialState: Partial<SmdState> = {},
  onError: (params: ErrorCallbackParams) => void = () => {},
  onWarning: (params: ErrorCallbackParams) => void = () => {},
  onProcessedLine: (params: ProcessLineCallbackParams) => void = () => {}
) => {
  const readyOptions = prepareOptions(options);
  setDbConfig({
    filePath: readyOptions.dbFilePath,
    initFilePath: readyOptions.dbInitFilePath,
  });

  const state: SmdState = {
    currentMunicipality: null,
    currentFilterMunicipality: null,
    currentSchool: null,
    municipalities: [],
    ...initialState,
  };

  let lineNumber = 1;

  for (const rawLine of lines) {
    const line = cleanLine(rawLine);
    processOneLine({
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
      state.currentMunicipality = getNewMunicipality("");
    }
    state.currentMunicipality.schools.push(
      mapSchoolForExport(state.currentSchool)
    );
  }

  if (state.currentMunicipality != null) {
    state.municipalities.push(convertMunicipality(state.currentMunicipality));
  }

  return state.municipalities;
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

const processOneLine = (params: ProcessLineParams) => {
  const { line, state } = params;

  if (line[0] === "#") {
    processMunicipalityLine(params);
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
    processSchoolLine(params);
    return;
  }

  if (isMunicipalitySwitch(line)) {
    processMunicipalitySwitchLine(params);
  } else if (isWholeMunicipality(line)) {
    processWholeMunicipalityLine(params);
  } else {
    processAddressPointLine(params);
  }
};

const processMunicipalityLine = ({ line, state }: ProcessLineParams) => {
  if (state.currentSchool !== null) {
    state.currentMunicipality.schools.push(state.currentSchool);
    state.currentSchool = null;
  }

  if (state.currentMunicipality !== null) {
    state.municipalities.push(convertMunicipality(state.currentMunicipality));
  }

  state.currentMunicipality = getNewMunicipality(line.substring(1).trim());
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

const processSchoolLine = ({ line, lineNumber, state }: ProcessLineParams) => {
  if (state.currentMunicipality === null) {
    throw new Error("No municipality defined on line " + lineNumber);
  }
  state.currentSchool = getNewSchool(line, state.currentMunicipality.founder);
  state.currentFilterMunicipality = founderToMunicipality(
    state.currentMunicipality.founder
  );
};

const processMunicipalitySwitchLine = ({
  line,
  state,
  lineNumber,
  onError,
}: ProcessLineParams) => {
  const { municipality, errors } = getSwitchMunicipality(line);
  if (errors.length > 0) {
    onError({ lineNumber, line, errors });
  } else {
    state.currentFilterMunicipality = municipality;
  }
};

const processWholeMunicipalityLine = ({
  line,
  state,
  lineNumber,
  onError,
}: ProcessLineParams) => {
  const { municipality, errors } = getWholeMunicipality(line);
  if (errors.length > 0) {
    onError({ lineNumber, line, errors });
  } else {
    const addressPoints = findAddressPoints(
      { wholeMunicipality: true, street: "", numberSpec: [] },
      municipality
    );
    state.currentSchool.addresses.push(
      ...filterOutSchoolAddressPoint(addressPoints, state.currentSchool).map(
        mapAddressPointForExport
      )
    );
  }
};

const processAddressPointLine = ({
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
    smdLines.forEach((smdLine) => {
      const { exists, errors } = checkStreetExists(
        smdLine.street,
        state.currentMunicipality.founder
      );
      if (errors.length > 0) {
        onWarning({ lineNumber, line, errors });
      }
      if (exists) {
        let addressPoints = findAddressPoints(
          smdLine,
          state.currentFilterMunicipality
        );

        state.currentSchool.addresses.push(
          ...filterOutSchoolAddressPoint(
            addressPoints,
            state.currentSchool
          ).map(mapAddressPointForExport)
        );
      }
    });
  }
};

export const getNewMunicipality = (
  name: string,
  options?: OpenDataSyncOptionsPartial
): MunicipalityWithFounder => {
  if (options) {
    options = prepareOptions(options);
    setDbConfig({
      filePath: options.dbFilePath,
      initFilePath: options.dbInitFilePath,
    });
  }
  const { founder, errors } = findFounder(name);
  if (errors.length > 0) {
    errors.forEach(console.error);
  }
  return {
    municipalityName: founder ? founder.name : "Neznámá obec",
    founder,
    schools: [],
  };
};

export const getNewSchool = (
  name: string,
  founder: Founder | null,
  options?: OpenDataSyncOptionsPartial
): School => {
  if (options) {
    options = prepareOptions(options);
    setDbConfig({
      filePath: options.dbFilePath,
      initFilePath: options.dbInitFilePath,
    });
  }
  let exportSchool: School = {
    name: name,
    izo: "",
    addresses: [],
  };
  if (founder !== null) {
    const { school } = findSchool(name, founder.schools);
    if (school) {
      school.izo = school.izo || "";
      if (school.locations.length > 0) {
        const position = getAddressPointById(
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
  position: mapAddressPointForExport(school.position),
});

const cleanLine = (line: string) => {
  return line.trim().replace(/–/g, "-");
};
