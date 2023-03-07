import { describe, expect, test } from "@jest/globals";
import { Founder, MunicipalityType } from "../../src/open-data-sync/models";
import { extractCityOrDistrictName } from "../../src/utils/helpers";

const createFounder = (
  name: string,
  municipalityType: MunicipalityType
): Founder => {
  return {
    name,
    ico: "",
    municipalityType,
    schools: [],
  };
};

describe("utils - extract name of a city or a district from founder's name", () => {
  test("test district names extraction", () => {
    const districts = [
      ["Městská část Praha 1", "Praha 1"],
      ["Městská část Praha - Koloděje", "Praha-Koloděje"],
      ["Městská část Praha - Dolní Chabry", "Praha-Dolní Chabry"],
      [
        "Městský obvod Liberec - Vratislavice nad Nisou",
        "Liberec-Vratislavice nad Nisou",
      ],
      ["Statutární město Brno, městská část Brno-sever", "Brno-sever"],
      ["Statutární město Brno, městská část  Brno-střed", "Brno-střed"],
      [
        "Statutární město Brno, městská část Brno-Řečkovice a Mokrá Hora",
        "Brno-Řečkovice a Mokrá Hora",
      ],
      ["Statutární město Ostrava, Městský obvod Ostrava-Jih", "Ostrava-Jih"],
      ["Statutární město Ostrava, Městský obvod  Krásné Pole", "Krásné Pole"],
      ["Nesmysl", "Nesmysl"],
      ["Mestsky Obvod Neco", "Mestsky Obvod Neco"],
    ];
    districts.forEach((district) => {
      expect(
        extractCityOrDistrictName(
          createFounder(district[0], MunicipalityType.District)
        )
      ).toBe(district[1]);
    });
  });

  test("test district names extraction", () => {
    const cities = [
      ["Obec Lužice", "Lužice"],
      ["obec Lipůvka", "Lipůvka"],
      ["obec Prusy - Boškůvky", "Prusy-Boškůvky"],
      ["Obec Olešnice v Orlických horách", "Olešnice v Orlických horách"],
      ["Městys Čechtice", "Čechtice"],
      ["Městys Louňovice pod Blaníkem", "Louňovice pod Blaníkem"],
      ["Městys  Protivanov", "Protivanov"],
      ["Městys Staré Město pod Landštejnem", "Staré Město pod Landštejnem"],
      ["Město Vsetín", "Vsetín"],
      ["Město Kostelec nad Černými lesy", "Kostelec nad Černými lesy"],
      ["Město Rychnov u Jablonce nad  Nisou", "Rychnov u Jablonce nad Nisou"],
      ["Statutární město Prostějov", "Prostějov"],
      ["Statutární město Mladá Boleslav", "Mladá Boleslav"],
    ];
    cities.forEach((city) => {
      expect(
        extractCityOrDistrictName(createFounder(city[0], MunicipalityType.City))
      ).toBe(city[1]);
    });
  });
});
