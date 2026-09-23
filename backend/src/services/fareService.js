const calculateFare = (distanceKm) => {
  const baseFare = Number(process.env.BASE_FARE || 300);
  const farePerKm = Number(process.env.FARE_PER_KM || 70);
  if (!Number.isFinite(baseFare) || !Number.isFinite(farePerKm)) throw new Error('Fare configuration is invalid');
  return Math.round(baseFare + (distanceKm * farePerKm));
};

const calculateRouteFare = async (originCoordinates, destinationCoordinates) => {
  if (!process.env.OPENROUTESERVICE_API_KEY) {
    const error = new Error('Routing service is not configured');
    error.statusCode = 503;
    throw error;
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