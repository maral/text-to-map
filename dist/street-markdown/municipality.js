import { findMunicipalityByNameAndType } from "../db/founders";
import { MunicipalityType } from "../db/types";
const municipalitySwitchPattern = /^navíc ulice (z )?(?<type>městské části|městského obvodu|obce|města) (?<name>.+):$/;
const wholeMunicipalityPattern = /^území (?<type>městské části|městského obvodu|obce|města) (?<name>.+)$/;
export const isMunicipalitySwitch = (line) => {
    return municipalitySwitchPattern.test(line);
};
export const getSwitchMunicipality = (line) => {
    const match = municipalitySwitchPattern.exec(line);
    if (match === null) {
        throw new Error("Invalid municipality switch line");
    }
    const { type, name } = match.groups;
    return getMunicipalityResult(type, name);
};
export const isWholeMunicipality = (line) => {
    return wholeMunicipalityPattern.test(line);
};
export const getWholeMunicipality = (line) => {
    const match = wholeMunicipalityPattern.exec(line);
    if (match === null) {
        return { errors: ["Invalid whole municipality line"], municipality: null };
    }
    const { type, name } = match.groups;
    return getMunicipalityResult(type, name);
};
const getMunicipalityResult = (type, name) => {
    const typeValue = getMunicipalityType(type);
    const { municipality, errors } = findMunicipalityByNameAndType(name, typeValue);
    return {
        municipality,
        errors,
    };
};
const getMunicipalityType = (type) => {
    switch (type) {
        case "městské části":
        case "městského obvodu":
            return MunicipalityType.District;
        case "obce":
        case "města":
            return MunicipalityType.City;
    }
};
