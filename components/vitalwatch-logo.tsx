import { Image, StyleSheet } from 'react-native';

type VitalWatchLogoProps = {
  compact?: boolean;
};

// Logo oficial entregado para el proyecto. Se mantiene como imagen local para
// que la app no dependa de Internet para mostrar su identidad.
export function VitalWatchLogo({ compact = false }: VitalWatchLogoProps) {
  return (
    <Image
      accessibilityLabel="Logo de VitalWatch"
      resizeMode="contain"
      source={require('../assets/images/vitalwatch-logo.png')}
      style={[styles.logo, compact && styles.compact]}
    />
  );
}

const styles = StyleSheet.create({
  logo: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    height: 180,
    width: 180,
  },
  compact: {
    height: 136,
    width: 136,
  },
});
