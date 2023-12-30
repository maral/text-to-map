import { readFileSync } from "fs";
const streetNamePattern = /^([^ -]+([ -]?[^ -]+)*)/;
const streetSeriesPartPattern = /(lichá č.|sudá č.|č. p.|č.)/;
const rangePattern = /(\d+[a-z]? ?[-] ?\d+[a-z]?|(od )?\d+[a-z]?( a)? výše|\d+[a-z]?)(, ?| a )/;
const numberPattern = /\d+/;
const OddTypeString = "lichá č.";
const EvenTypeString = "sudá č.";
const AllTypeString = "č.";
const CPTypeString = "č. p.";
const StreetNumberSeriesType = {
    Odd: "odd",
    Even: "even",
    CP: "cp",
    All: "all",
};
const _min = 0;
const _max = 10000;
const StreetNumberRule = {
    MinFrom: _min,
    MaxTo: _max,
    EmptyRule: {
        type: StreetNumberSeriesType.All,
        from: _min,
        to: _max,
    },
};
const createStreetRule = (type, from = StreetNumberRule.MinFrom, to = StreetNumberRule.MaxTo) => {
    return {
        type: type,
        from: from,
        to: to,
    };
};
const getStreetRules = (numberSpecification) => {
    let rules = [];
    let position = 0;
    if (numberSpecification == "") {
        return [StreetNumberRule.EmptyRule];
    }
    while (position < numberSpecification.length) {
        var remainder = numberSpecification.substr(position);
        var match = streetSeriesPartPattern.exec(remainder);
        // if no series type is found, it's an error
        if (match == null || match.index != 0) {
            return null;
        }
        var type = getSeriesType(match[0]);
        position += match[0].length;
        remainder = numberSpecification.substr(position);
        match = streetSeriesPartPattern.exec(remainder);
        var end = numberSpecification.length;
        if (match != null) {
            end = position + match.index;
        }
        var rangePart = numberSpecification.substr(position, end - position);
        rules = rules.concat(getRulesFromRangePart(rangePart, type));
        position = end;
    }
    return rules;
};
const getRulesFromRangePart = (rangePart, seriesType) => {
    let rules = [];
    if (removeSeparatorFromEnd(rangePart) == "") {
        rules.push(createStreetRule(seriesType));
        return rules;
    }
    let position = 0;
    rangePart = rangePart.trim() + ", ";
    while (position < rangePart.length) {
        var match = rangePattern.exec(rangePart.substr(position));
        if (match == null) {
            break;
        }
        position += match.index + match[0].length;
        var value = removeSeparatorFromEnd(match[0]);
        if (value.indexOf("-") != -1) {
            var fromTo = value.split("-");
            rules.push(createStreetRule(seriesType, parseInt(fromTo[0]), fromTo[1]));
        }
        else if (value.indexOf("výše") != -1) {
            var number = parseInt(numberPattern.exec(value)[0]);
            rules.push(createStreetRule(seriesType, number));
        }
        else {
            var number = parseInt(numberPattern.exec(value)[0]);
            rules.push(createStreetRule(seriesType, number, number));
        }
    }
    return rules;
};
const getSeriesType = (pattern) => {
    switch (pattern) {
        case OddTypeString:
            return StreetNumberSeriesType.Odd;
        case EvenTypeString:
            return StreetNumberSeriesType.Even;
        case CPTypeString:
            return StreetNumberSeriesType.CP;
        case AllTypeString:
        default:
            return StreetNumberSeriesType.All;
    }
};
const removeSeparatorFromEnd = (text) => {
    text = text.trim();
    if (text[text.length - 1] == "a" || text[text.length - 1] == ",") {
        text = text.substr(0, text.length - 1);
    }
    return text.trim();
};
// desired output format:
// Příčná(str);from(int);to(int);[odd|even|all|cp];school(str)
export function districtsToCsvRules(districts, includeDistrictName = false) {
    const lines = [];
    districts.forEach((district) => {
        district.schools.forEach((school) => {
            school.lines.forEach((street) => {
                if (street[0] == "!" || street == "") {
                    return;
                }
                let result = streetNamePattern.exec(street);
                let streetName = result[0];
                let numberSpecification = street.substr(streetName.length + 3).trim();
                let rules = getStreetRules(numberSpecification);
                if (rules == null || rules.length == 0) {
                    console.error("Error: " + street);
                    return;
                }
                rules.forEach((rule) => {
                    lines.push(streetName +
                        ";" +
                        rule.from +
                        ";" +
                        rule.to +
                        ";" +
                        rule.type +
                        ";" +
                        school.name +
                        (includeDistrictName ? ";" + district.name : ""));
                });
            });
        });
    });
    return lines.join("\n");
}
// let raw = readFileSync("out.json", "utf-8");
// let districts;
// try {
//   districts = JSON.parse(raw);
// } catch (error) {
//   console.log(error);
//   return;
// }
