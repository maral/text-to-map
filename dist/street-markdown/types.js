export const isWholeMunicipalitySmdLine = (something) => something.hasOwnProperty("wholeMunicipality");
export const isSeriesSpecArray = (something) => Array.isArray(something);
export const isNegativeSeriesSpec = (something) => something.hasOwnProperty("negative");
export const isFullStreetNumber = (something) => something.hasOwnProperty("orientationNumber");
export const isRange = (something) => !something.hasOwnProperty("orientationNumber");
export var SeriesType;
(function (SeriesType) {
    SeriesType[SeriesType["Even"] = 0] = "Even";
    SeriesType[SeriesType["Odd"] = 1] = "Odd";
    SeriesType[SeriesType["All"] = 2] = "All";
    SeriesType[SeriesType["Descriptive"] = 3] = "Descriptive";
})(SeriesType || (SeriesType = {}));
export var AddressPointType;
(function (AddressPointType) {
    AddressPointType[AddressPointType["Descriptive"] = 0] = "Descriptive";
    AddressPointType[AddressPointType["Registration"] = 1] = "Registration";
})(AddressPointType || (AddressPointType = {}));
export const isAddressPoint = (something) => something.hasOwnProperty("id");
