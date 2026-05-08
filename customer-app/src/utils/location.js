import * as Location from 'expo-location';

export async function getCurrentLocationLabel() {
  try {
    const permission = await Location.getForegroundPermissionsAsync();
    let status = permission.status;
    if (status !== 'granted') {
      const requested = await Location.requestForegroundPermissionsAsync();
      status = requested.status;
    }

    if (status !== 'granted') {
      return 'Location permission denied';
    }

    const servicesEnabled = await Location.hasServicesEnabledAsync();
    if (!servicesEnabled) {
      return 'Location services are turned off';
    }

    // Fast path first (cached value), then force a fresh GPS/network fix.
    let position = await Location.getLastKnownPositionAsync();
    if (!position) {
      position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        mayShowUserSettingsDialog: true,
      });
    }

    const lat = position?.coords?.latitude;
    const lon = position?.coords?.longitude;
    if (typeof lat !== 'number' || typeof lon !== 'number') {
      return 'Location unavailable';
    }

    let readable = '';
    try {
      const places = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
      const place = places?.[0];
      const locality = place?.city || place?.district || place?.subregion || '';
      const region = place?.region || '';
      const country = place?.country || '';
      readable = [locality, region, country].filter(Boolean).join(', ');
    } catch {
      // Reverse geocoding may fail on some networks/devices; coordinates are still usable.
    }

    return readable || `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  } catch {
    return 'Location unavailable';
  }
}
