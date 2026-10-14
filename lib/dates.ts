export function jakartaDateBound(value: string, endOfDay = false) {
  const localTime = endOfDay ? "23:59:59" : "00:00:00";
  return new Date(`${value}T${localTime}+07:00`).toISOString().replace("T", " ").slice(0, 19);
}
