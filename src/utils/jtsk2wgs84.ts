export interface WGS84Coords {
  wgs84_latitude: string;
  wgs84_longitude: string;
  lat: number;
  lon: number;
  vyska: number;
}

export default function jtsk_to_wgs(
  X: number,
  Y: number,
  H: number = 200
): WGS84Coords {
  var coord = {
    wgs84_latitude: "",
    wgs84_longitude: "",
    lat: 0,
    lon: 0,
    vyska: 0,
  };

  /* Přepočet vstupích údajů - vychazi z nejakeho skriptu, ktery jsem nasel na Internetu - nejsem autorem prepoctu. */

  /*Vypocet zemepisnych souradnic z rovinnych souradnic*/
  let a = 6377397.15508;
  let e = 0.081696831215303;
  let n = 0.97992470462083;
  let konst_u_ro = 12310230.12797036;
  let sinUQ = 0.863499969506341;
  let cosUQ = 0.504348889819882;
  let sinVQ = 0.420215144586493;
  let cosVQ = 0.907424504992097;
  let alfa = 1.000597498371542;
  let k = 1.003419163966575;
  let ro = Math.sqrt(X * X + Y * Y);
  let epsilon = 2 * Math.atan(Y / (ro + X));
  let D = epsilon / n;
  let S =
    2 * Math.atan(Math.exp((1 / n) * Math.log(konst_u_ro / ro))) - Math.PI / 2;
  let sinS = Math.sin(S);
  let cosS = Math.cos(S);
  let sinU = sinUQ * sinS - cosUQ * cosS * Math.cos(D);
  let cosU = Math.sqrt(1 - sinU * sinU);
  let sinDV = (Math.sin(D) * cosS) / cosU;
  let cosDV = Math.sqrt(1 - sinDV * sinDV);
  let sinV = sinVQ * cosDV - cosVQ * sinDV;
  let cosV = cosVQ * cosDV + sinVQ * sinDV;
  let Ljtsk = (2 * Math.atan(sinV / (1 + cosV))) / alfa;
  let t = Math.exp((2 / alfa) * Math.log((1 + sinU) / cosU / k));
  let pom = (t - 1) / (t + 1);
  let sinB;
  do {
    sinB = pom;
    pom = t * Math.exp(e * Math.log((1 + e * sinB) / (1 - e * sinB)));
    pom = (pom - 1) / (pom + 1);
  } while (Math.abs(pom - sinB) > 1e-15);

  let Bjtsk = Math.atan(pom / Math.sqrt(1 - pom * pom));

  /* Pravoúhlé souřadnice ve S-JTSK */
  a = 6377397.15508;
  let f_1 = 299.152812853;
  let e2 = 1 - (1 - 1 / f_1) * (1 - 1 / f_1);
  ro = a / Math.sqrt(1 - e2 * Math.sin(Bjtsk) * Math.sin(Bjtsk));
  let x = (ro + H) * Math.cos(Bjtsk) * Math.cos(Ljtsk);
  let y = (ro + H) * Math.cos(Bjtsk) * Math.sin(Ljtsk);
  let z = ((1 - e2) * ro + H) * Math.sin(Bjtsk);

  /* Pravoúhlé souřadnice v WGS-84*/
  let dx = 570.69;
  let dy = 85.69;
  let dz = 462.84;
  let wz = ((-5.2611 / 3600) * Math.PI) / 180;
  let wy = ((-1.58676 / 3600) * Math.PI) / 180;
  let wx = ((-4.99821 / 3600) * Math.PI) / 180;
  let m = 3.543e-6;
  let xn = dx + (1 + m) * (x + wz * y - wy * z);
  let yn = dy + (1 + m) * (-wz * x + y + wx * z);
  let zn = dz + (1 + m) * (wy * x - wx * y + z);

  /* Geodetické souřadnice v systému WGS-84*/
  a = 6378137.0;
  f_1 = 298.257223563;
  let a_b = f_1 / (f_1 - 1);
  let p = Math.sqrt(xn * xn + yn * yn);
  e2 = 1 - (1 - 1 / f_1) * (1 - 1 / f_1);
  let theta = Math.atan((zn * a_b) / p);
  let st = Math.sin(theta);
  let ct = Math.cos(theta);
  t = (zn + e2 * a_b * a * st * st * st) / (p - e2 * a * ct * ct * ct);
  let B = Math.atan(t);
  let L = 2 * Math.atan(yn / (p + xn));
  H = Math.sqrt(1 + t * t) * (p - a / Math.sqrt(1 + (1 - e2) * t * t));

  /* Formát výstupních hodnot */

  B = (B / Math.PI) * 180;

  coord.lat = B;
  let latitude = "N";
  if (B < 0) {
    B = -B;
    latitude = "S";
  }

  let st_sirky = Math.floor(B);
  B = (B - st_sirky) * 60;
  let min_sirky = Math.floor(B);
  B = (B - min_sirky) * 60;
  let vt_sirky = Math.round(B * 1000) / 1000;
  latitude = st_sirky + "°" + min_sirky + "'" + vt_sirky + latitude;
  coord.wgs84_latitude = latitude;

  L = (L / Math.PI) * 180;
  coord.lon = L;
  let longitude = "E";
  if (L < 0) {
    L = -L;
    longitude = "W";
  }

  let st_delky = Math.floor(L);
  L = (L - st_delky) * 60;
  let min_delky = Math.floor(L);
  L = (L - min_delky) * 60;
  let vt_delky = Math.round(L * 1000) / 1000;
  longitude = st_delky + "°" + min_delky + "'" + vt_delky + longitude;
  coord.wgs84_longitude = longitude;

  coord.vyska = Math.round(H * 100) / 100;

  return coord;
}
