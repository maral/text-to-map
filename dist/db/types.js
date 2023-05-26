export var MunicipalityType;
(function (MunicipalityType) {
    MunicipalityType[MunicipalityType["City"] = 0] = "City";
    MunicipalityType[MunicipalityType["District"] = 1] = "District";
    MunicipalityType[MunicipalityType["Other"] = 2] = "Other";
})(MunicipalityType || (MunicipalityType = {}));
export const founderToMunicipality = (founder) => {
    return {
        type: founder.municipalityType,
        code: founder.cityOrDistrictCode,
    };
};
