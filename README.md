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

## Street Markdown
Street Markdown je formát, který po vzoru značkovacího jazyka [Markdown](https://en.wikipedia.org/wiki/Markdown) má za cíl usnadnit psaní strukturovaných dat bez nutnosti učit se složité formátovací tagy nebo používat speciální znaky. Vznikl na základě [pražské spádové vyhlášky z roku 2021](https://www.praha.eu/file/3251117/vyhlaska_c._4.pdf) a snaží se být co nejkompatibilnější s již používaným formátem.

Street Markdown je dále možný rozšiřovat pro další případy použití - například protialkoholová vyhláška (do standardu by byla třeba přidat definice parků), tržní vyhláška, vyhláška o buskingu a další.

### Pravidla Street Markdownu

* **prázdné znaky a řádky**
    * veškeré po sobě jdoucí mezery jsou ignorovány a počítají se jako jedna mezera
    * prázdné řádky mají ve formátu speciální význam, několik prázdných řádků za sebou se ignoruje a počítá se jako jeden prázdný řádek
* **blok oblasti**
    * v případě SMD pro více obcí či městských částí je uvozen blok oblasti pomocí _názvu oblasti_, následuje prázdný řádek a poté libovolný počet _bloků škol_
    * _blok oblasti_ končí řádkem před _nadpisem oblasti_ následujícího _bloku obce_ nebo koncem souboru
* **název oblasti**
    * začíná znakem "#" následovaný mezerou a textovým řetězcem, který obsahuje přesný název obce
    * příklady:
       * \# Praha 1
       * \# Pelhřimov
       * \# Poděbrady
* **blok školy**
    * jde o souvislý blok bez vynechaných řádků
    * bloky škol jsou od sebe odděleny jedním či více prázdnými řádky
* **název školy**
    * první řádek bloku řádků je název školy
    * libovolný neprázdný textový řetězec
* **definice ulice**
    * definice ulice obsahuje _jméno ulice_ a volitelně _specifikaci orientačních čísel_
    * pokud celá ulice patří do aktuálního bloku školy, pak se specifikace orientačních čísel neuvádí, uvede se pouze název ulice
    * název ulice se uvádí v plně rozvinutém tvaru
        * špatně: nám. Míru, Rašínovo nábř.
        * správně: náměstí Míru, Rašínovo nábřeží
    * jméno ulice a specifikace ulice je odděleno znaménkem minus (a volitelnými mezerami okolo pomlčky) - místo minus jsou přípustné i pomlčka a spojovník
* **specifikace orientačních čísel**
    * za sebou jdoucí výčet _rozsahů čísel_
    * _rozsahy čísel_ jsou odděleny čárkou a mezerou (", ") nebo spojkou " a "
* **rozsah čísel**
    * jako rozsah čísel se považuje specifikace, zda jde o _typ čísel_ (všechna, sudá či lichá čísla) a _rozsah_ od-do, a to v následujícím formátu:
        * **typ čísel**
            * všechna = "č."
            * lichá = "lichá č."
            * sudá = "sudá č."
            * čísla popisná = "č. p."
        * **rozsah čísel**
            * může jít o výčet (oddělený ", " nebo " a ") těchto možností:
                * a) <číslo>, např. 7
                * b) <číslo>-<číslo>, např. 2-66 (přípustné jsou pomlčka, spojovník, minus)
                * c) (od) <číslo> (a) výše, např. od 20 výše, 14 a výše, od 7 a výše
                * d) do (č.) <číslo>
            * např. 1-9, 11, od 23 výše

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/E1E5JOMLT)
