import Platform, { DevicePlatformAccessory } from '../platform';
import Device from '../api/Device';

export enum AccessoryType {
  Thermostat = 'Thermostat'
}

interface Accessory {
  get UUID(): string;
}

export interface AccessoryConstructor {
  new (
    device: Device,
    platform: Platform,
    accessory: DevicePlatformAccessory
  ): Accessory;
}

export default Accessory;
