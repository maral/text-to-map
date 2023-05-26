/*
  Taken from https://github.com/letomas/RUIAN-search and ported to typescript.

  MIT License

  Copyright (c) 2020 Tomáš Le

  Permission is hereby granted, free of charge, to any person obtaining a copy
  of this software and associated documentation files (the "Software"), to deal
  in the Software without restriction, including without limitation the rights
  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  copies of the Software, and to permit persons to whom the Software is
  furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in all
  copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
  SOFTWARE.
 */

import { AddressPoint, AddressPointType } from "../street-markdown/types";

export interface ThreeRowsAddress {
  firstRow: string;
  secondRow: string;
  thirdRow: string;
}

export const buildInline = (address: AddressPoint): string => {
  const addressInRows = build(address);

  let result = addressInRows.firstRow + ", " + addressInRows.secondRow;
  if (addressInRows.thirdRow) {
    result += ", " + addressInRows.thirdRow;
  }

  return result;
};

export const build = (address: AddressPoint): ThreeRowsAddress => {
  const result: ThreeRowsAddress = {
    firstRow: "",
    secondRow: "",
    thirdRow: "",
  };
  if (!!address.street && !districtEqualsCity(address)) {
    result.secondRow = address.district;
  }

  if (!address.street) {
    if (address.city === address.district) {
      let buildingType =
        address.type === AddressPointType.Registration ? " č. ev. " : "č. p. ";
      result.firstRow = buildingType + address.descriptiveNumber;
    } else {
      result.firstRow = address.district;
      result.firstRow += " " + buildHouseNumber(address);
    }

    result.firstRow += buildOrientationalNumber(address);
    buildLastRow(result, address);

    return result;
  }

  result.firstRow = address.street;
  result.firstRow += " " + buildHouseNumber(address);
  result.firstRow += buildOrientationalNumber(address);
  buildLastRow(result, address);

  return result;
};

const buildHouseNumber = (address: AddressPoint) => {
  if (address.type === AddressPointType.Registration) {
    return "č. ev. " + address.descriptiveNumber;
  }

  return address.descriptiveNumber;
};

const buildOrientationalNumber = (address: AddressPoint) => {
  if (address.orientationalNumber) {
    return (
      "/" +
      address.orientationalNumber +
      (address.orientationalNumberLetter ?? "")
    );
  }
  return "";
};

const buildLastRow = (result: ThreeRowsAddress, address: AddressPoint) => {
  // if (!result.secondRow) {
  //   if (address.city === "Praha") {
  //     result.secondRow = address.postalCode + " " + address.pragueBoroughName;
  //   } else {
  //     result.secondRow = address.postalCode + " " + address.cityName;
  //   }
  // } else {
  //   if (address.cityName === "Praha") {
  //     result.thirdRow = address.postalCode + " " + address.pragueBoroughName;
  //   } else {
  //     result.thirdRow = address.postalCode + " " + address.cityName;
  //   }
  // }
  if (!result.secondRow) {
    result.secondRow = address.postalCode + " " + address.city;
  } else {
    result.thirdRow = address.postalCode + " " + address.city;
  }
};

const districtEqualsCity = (address: AddressPoint) => {
  return address.district === address.city;
};
