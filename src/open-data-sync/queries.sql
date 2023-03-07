-- schools with locations without GPS
SELECT * FROM `school` s
JOIN `school_location` l ON s.izo=l.school_izo
JOIN `address_point` a ON l.address_point_id=a.id
WHERE a.jtsk_x IS NULL;

-- schools without any location
SELECT * FROM `school` s
LEFT JOIN `school_location` l ON s.izo=l.school_izo
WHERE l.school_izo IS NULL;

-- count of school locations of selected schools
SELECT izo, COUNT(l.address_point_id) FROM school s
JOIN school_location l ON s.izo = l.school_izo
WHERE s.izo IN ("108006018", "108007022", "108007022", "110000021", "060158981", "181065983", "045243581", "000241610", "102516634", "049753347", "102165823", "102067481", "102191379", "102255172", "102319171", "102591491", "102655561", "102807469", "102843872", "102855773", "102263639", "102780447", "150012799", "102080038", "102642273", "181071339")
GROUP BY izo;

-- select founder city name by school izo
SELECT c.name FROM school s
JOIN school_location l ON s.izo = l.school_izo
JOIN address_point a ON l.address_point_id = a.id
JOIN city c ON a.city_code = c.code
WHERE s.izo = "102390479"
LIMIT 1