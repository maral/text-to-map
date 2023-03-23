# Text To Map
Text To Map usiluje o lepší, strojově zpracovatelné využití částí vyhlášek s výčtem ulic a dalších lokací. Jde o rozšiřitelnou sadu konceptů a nástrojů, které zajistí hladký převod výčtu ulic a jejich rozsahů v lidsky srozumitelném jazyce do strojově zpracovatelného, uchopitelného formátu.

## Odkazy
- [text-to-map-frontend](https://github.com/maral/text-to-map-frontend) - mapa zobrazující výstupy této knihovny

## Živě na webu
- [Spádové oblasti - Praha](https://mareklisy.cz/spadovosti-praha/)

## Návod na použití
1. `npm install`
2. `npm run address-points` - stažení a import adresních bodů z RÚIAN
3. `npm run schools` - stažení a import dat o školách a zřizovatelích z rejstříku MŠMT
4. `npm run streets` - dotažení všech ulic z RÚIAN (nepovinné, ale zmizí tím warningy o neexistujících ulicích ve vyhlášce v případech, kdy jsou ve vyhlášce ulice bez jediného adresního bodu)
5. `npm run parse-ordinance /some/path/input.txt /path/output.json` - parsování vyhlášky a namapování adresních míst na spádové školy

Pro vyzkoušení je možné použít již vyčištěné vyhlášky ze složky *examples*.


[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/E1E5JOMLT)
