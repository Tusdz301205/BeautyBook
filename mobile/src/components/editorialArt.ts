import type { ImageSourcePropType } from 'react-native';

/** Project-owned editorial still lifes (see assets/editorial/manifest.md). Decorative only, never entity photos. */
export const editorial = {
  homeHero: require('../../assets/editorial/home-hero.webp') as ImageSourcePropType,
  invitation: require('../../assets/editorial/invitation.webp') as ImageSourcePropType,
  planning: require('../../assets/editorial/planning.webp') as ImageSourcePropType,
  authLogin: require('../../assets/editorial/auth-login.webp') as ImageSourcePropType,
  authRegister: require('../../assets/editorial/auth-register.webp') as ImageSourcePropType,
  authRecovery: require('../../assets/editorial/auth-recovery.webp') as ImageSourcePropType,
};
