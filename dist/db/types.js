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
export var SyncPart;
(function (SyncPart) {
    SyncPart["AddressPoints"] = "address-points";
    SyncPart["Schools"] = "schools";
    SyncPart["Regions"] = "regions";
    SyncPart["Streets"] = "streets";
    SyncPart["Cities"] = "cities";
})(SyncPart || (SyncPart = {}));
