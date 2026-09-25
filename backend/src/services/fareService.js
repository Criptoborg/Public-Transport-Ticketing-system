const calculateFare = (distanceKm) => {
  const baseFare = Number(process.env.BASE_FARE || 300);
  const farePerKm = Number(process.env.FARE_PER_KM || 70);
  if (!Number.isFinite(baseFare) || !Number.isFinite(farePerKm)) throw new Error('Fare configuration is invalid');
  return Math.round(baseFare + (distanceKm * farePerKm));
};

const calculateStraightLineDistance = (originCoordinates, destinationCoordinates) => {
  const toRadians = (degrees) => degrees * (Math.PI / 180);
  const latitudeDifference = toRadians(destinationCoordinates.latitude - originCoordinates.latitude);
  const longitudeDifference = toRadians(destinationCoordinates.longitude - originCoordinates.longitude);
  const originLatitude = toRadians(originCoordinates.latitude);
  const destinationLatitude = toRadians(destinationCoordinates.latitude);
  const earthRadiusKm = 6371;
  const haversine = Math.sin(latitudeDifference / 2) ** 2
    + Math.cos(originLatitude) * Math.cos(destinationLatitude) * Math.sin(longitudeDifference / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(haversine));
};

const calculateRouteFare = async (originCoordinates, destinationCoordinates) => {
  if (!process.env.OPENROUTESERVICE_API_KEY) {
    const distanceKm = calculateStraightLineDistance(originCoordinates, destinationCoordinates);
    return { distanceKm: Number(distanceKm.toFixed(2)), fare: calculateFare(distanceKm) };
  }

  const params = new URLSearchParams({
    api_key: process.env.OPENROUTESERVICE_API_KEY,
    start: `${originCoordinates.longitude},${originCoordinates.latitude}`,
    end: `${destinationCoordinates.longitude},${destinationCoordinates.latitude}`
  });
  const response = await fetch(`https://api.openrouteservice.org/v2/directions/driving-car?${params}`);
  const result = await response.json();
 if (!response.ok) {
  console.error('OpenRouteService error:', response.status, result);

  const error = new Error('Routing service could not calculate the distance');
  error.statusCode = 502;
  throw error;
}
  

  const distanceMeters = result.routes?.[0]?.summary?.distance ?? result.features?.[0]?.properties?.segments?.[0]?.distance;
  if (!Number.isFinite(distanceMeters)) {
    const error = new Error('Routing service returned no route distance');
    error.statusCode = 502;
    throw error;
  }

  const distanceKm = distanceMeters / 1000;
  return { distanceKm: Number(distanceKm.toFixed(2)), fare: calculateFare(distanceKm) };
};

module.exports = { calculateFare, calculateRouteFare };