var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { findMunicipalityByNameAndType, findMunicipalityPartByName, } from "../db/founders";
import { MunicipalityType } from "../db/types";
const municipalityPartPattern = /^část (?<type>obce|města) (?<name>.+)$/;
const municipalitySwitchStartPattern = /^navíc ulice /;
const municipalitySwitchPattern = /^navíc ulice (z )?(?<type>městské části|městského obvodu|obce|města) (?<name>.+):$/;
const wholeMunicipalityStartPattern = /^území /;
const wholeMunicipalityPattern = /^území (?<type>městské části|městského obvodu|obce|města) (?<name>.+)$/;
const noStreetNamePattern = /^všechny ostatní budovy bez názvu ulice\s*$/;
export const isMunicipalityPart = (line) => {
    return municipalityPartPattern.test(line);
};
export const getMunicipalityPart = (line, founder) => __awaiter(void 0, void 0, void 0, function* () {
    const match = municipalityPartPattern.exec(line);
    if (match === null) {
        return {
            errors: [
                {
                    message: "Neplatný zápis pro přidání části obce. Správný zápis je: části <obce/města> <název části obce>. Např.: 'části obce Kladno' (název části obce musí být v 1. pádě).",
                    startOffset: 0,
                    endOffset: line.length + 1,
                },
            ],
            municipalityPartCode: null,
        };
    }
    const { name } = match.groups;
    return yield getMunicipalityPartResult(cleanName(name), line, founder);
});
export const isMunicipalitySwitch = (line) => {
    return municipalitySwitchStartPattern.test(line);
};
export const getSwitchMunicipality = (line, founder) => __awaiter(void 0, void 0, void 0, function* () {
    const match = municipalitySwitchPattern.exec(line);
    if (match === null) {
        return {
            errors: [
                {
                    message: "Neplatný zápis pro dočasnou změnu obce v definici ulic. Správný zápis je: navíc ulice <typ> <název obce>. Např.: 'navíc ulice obce Mokrá Lhota:' (název obce musí být v 1. pádě).",
                    startOffset: 0,
                    endOffset: line.length + 1,
                },
            ],
            municipality: null,
        };
    }
    const { type, name } = match.groups;
    return yield getMunicipalityResult(type, cleanName(name), line, founder);
});
export const isWholeMunicipality = (line) => {
    return wholeMunicipalityStartPattern.test(line);
};
export const isNoStreetNameLine = (line) => {
    return noStreetNamePattern.test(line);
};
export const getWholeMunicipality = (line, founder) => __awaiter(void 0, void 0, void 0, function* () {
    const match = wholeMunicipalityPattern.exec(line);
    if (match === null) {
        return {
            errors: [
                {
                    message: "Neplatný zápis pro přidání celé obce. Správný zápis je: území <typ> <název obce>. Např.: 'území obce Kladno' (název obce musí být v 1. pádě).",
                    startOffset: 0,
                    endOffset: line.length + 1,
                },
            ],
            municipality: null,
        };
    }
    const { type, name } = match.groups;
    return yield getMunicipalityResult(type, cleanName(name), line, founder);
});
const getMunicipalityResult = (type, name, line, founder) => __awaiter(void 0, void 0, void 0, function* () {
    const typeValue = getMunicipalityType(type);
    const { municipality, errors } = yield findMunicipalityByNameAndType(name, typeValue, founder);
    const startOffset = line.indexOf(name);
    const endOffset = startOffset + name.length + 1;
    return {
        municipality,
        errors: errors.map((error) => (Object.assign(Object.assign({}, error), { startOffset,
            endOffset }))),
    };
});
const getMunicipalityPartResult = (name, line, founder) => __awaiter(void 0, void 0, void 0, function* () {
    const { municipalityPartCode, errors } = yield findMunicipalityPartByName(name, founder);
    const startOffset = line.indexOf(name);
    const endOffset = startOffset + name.length + 1;
    return {
        municipalityPartCode,
        errors: errors.map((error) => (Object.assign(Object.assign({}, error), { startOffset,
            endOffset }))),
    };
});
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
const cleanName = (name) => {
    return name.trim();
};
