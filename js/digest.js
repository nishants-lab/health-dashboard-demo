import { latest, previous } from "./data.js";
export function computeDigest(markers) {
 return markers.flatMap(marker => {
  const cur=latest(marker.series), prev=previous(marker.series,cur.index);
  if(cur.value===null || prev.value===null || cur.value===prev.value) return [];
  return [{marker,from:prev.value,to:cur.value,kind:"changed",rising:cur.value>prev.value}];
 }).slice(0,8);
}
export const digestCopy={changed:{text:"vs previous measurement"}};
