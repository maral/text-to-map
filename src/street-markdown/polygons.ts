import * as turf from "@turf/turf";
import * as graphlib from "graphlib";
import { AddressPoint, Municipality } from "./types";

// Replace this with your merged polygons array
const polygons: turf.AllGeoJSON[] = [];

export const municipalityToPolygons = (municipality: Municipality) => {
  const polygons: turf.AllGeoJSON[] = [];

  municipality.schools.forEach((school, index) => {
    const points = school.addresses.map((address) => [
      address.lng,
      address.lat,
    ]);

    const bbox = turf.bbox(turf.points(points));

    const voronoi = turf.voronoi(turf.points(points, { index }), {
      bbox,
    });
    polygons.push(voronoi);
  });
  return polygons;
};

// // Create a graph
// const graph = new graphlib.Graph();

// // Add nodes to the graph
// polygons.forEach((polygon, index) => {
//   graph.setNode(index, { polygon: polygon, color: null });
// });

// // Add edges between neighboring polygons
// polygons.forEach((polygonA, indexA) => {
//   polygons.forEach((polygonB, indexB) => {
//     if (indexA !== indexB && turf.intersect(polygonA, polygonB)) {
//       graph.setEdge(indexA, indexB);
//     }
//   });
// });

// // Define colors
// const colors = ['red', 'green', 'blue', 'yellow']; // Four colors for the Four Color Theorem

// // Implement the greedy graph coloring algorithm
// graph.nodes().forEach((nodeId) => {
//   const neighbors = graph.neighbors(nodeId);
//   const usedColors = neighbors.map((neighborId) => graph.node(neighborId).color);

//   for (const color of colors) {
//     if (!usedColors.includes(color)) {
//       graph.node(nodeId).color = color;
//       break;
//     }
//   }
// });

// // Assign the colors to the polygons
// const coloredPolygons = graph.nodes().map((nodeId) => {
//   const nodeData = graph.node(nodeId);
//   return {
//     polygon: nodeData.polygon,
//     color: nodeData.color,
//   };
// });

// console.log(coloredPolygons);
