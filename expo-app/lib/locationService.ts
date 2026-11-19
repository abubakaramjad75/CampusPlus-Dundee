import * as Location from 'expo-location';

export async function getCurrentCampusCoords(): Promise<{
  granted: boolean;
  lat?: number;
  lng?: number;
}> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    return { granted: false };
  }
  const pos = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  return {
    granted: true,
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
  };
}
