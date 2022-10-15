import AsyncLock from 'async-lock';
import {
  DynamicPlatformPlugin,
  PlatformAccessory,
  PlatformConfig,
  Characteristic,
  Service,
  Logger,
  API
} from 'homebridge';

import ThermostatAccessory from './services/thermostat';
import DeskAccessory from './services/desk';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { DeviceContext } from './types/Device';
import DebugMode from './debugMode';
import delay from './utils/delay';
import Device from './api/Device';
import Accessory, {
  AccessoryConstructor,
  AccessoryType
} from './types/Accessory';

export type DevicePlatformAccessory = PlatformAccessory<DeviceContext>;
export interface DeviceConfigSchema {
  secret?: string;
  ip: string;
}

export default class Platform implements DynamicPlatformPlugin {
  private static readonly LOCK_NAME = 'device-operation';
  private static readonly lock = new AsyncLock();

  private cachedAccessories: DevicePlatformAccessory[] = [];
  private readonly registeredDevices: Accessory<any>[] = [];

  public get Devices() {
    return this.registeredDevices;
  }

  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic =
    this.api.hap.Characteristic;

  public readonly debugger: DebugMode;

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API
  ) {
    const { devices, enableDebugMode } = this.config ?? {};
    this.debugger = new DebugMode(!!enableDebugMode, this.log);

    try {
      if (devices?.length === 0) {
        this.log.info('Setup the configuration first!');
        this.cleanAccessories();
        return;
      }

      this.debugger.debug('[PLATFORM]', 'Debug mode enabled');

      this.api.on('didFinishLaunching', () => {
        this.discoverDevices();
      });
    } catch (error: any) {
      this.log.error(`Error: ${error?.message}`);
    }
  }

  configureAccessory(accessory: DevicePlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);
    this.cachedAccessories.push(accessory);
  }

  private cleanAccessories() {
    try {
      if (this.cachedAccessories.length > 0) {
        this.debugger.debug(
          '[PLATFORM]',
          'Removing cached accessories because the device list is empty (Count:',
          `${this.cachedAccessories.length})`
        );

        this.api.unregisterPlatformAccessories(
          PLUGIN_NAME,
          PLATFORM_NAME,
          this.cachedAccessories
        );
      }
    } catch (error: any) {
      this.log.error(`Error for cached accessories: ${error?.message}`);
    }
  }

  private async discoverDevices() {
    const { devices } = this.config ?? {};

    try {
      devices.forEach(
        ({ ip, secret }: DeviceConfigSchema) =>
          new Device(
            this.debugger,
            this.loadDevice.bind(this),
            ip,
            this.api,
            secret
          )
      );

      this.checkOldDevices();
    } catch (error: any) {
      this.log.error(`Error: ${error?.message}`);
    }
  }

  private loadDevice(deviceContext: DeviceContext, device: Device) {
    Platform.lock.acquire(Platform.LOCK_NAME, async () => {
      await delay(10);
      try {
        const deviceAlreadyRegistered = this.registeredDevices.find(
          (device) => device.UUID === deviceContext.uuid
        );

        if (deviceAlreadyRegistered) {
          this.log.info(
            `Device ${deviceContext.ip} is already registered. (UUID: ${deviceContext.uuid})`
          );
          return;
        }

        const existingAccessory = this.cachedAccessories.find(
          (accessory) => accessory.UUID === deviceContext.uuid
        );

        let Accessory: AccessoryConstructor;

        switch (deviceContext.type) {
          case AccessoryType.Thermostat:
            Accessory = ThermostatAccessory;
            break;
          case AccessoryType.Desk:
            Accessory = DeskAccessory;
            break;
          default:
            this.log.error(
              `Unknown accessory type '${deviceContext.type}' for '${deviceContext.ip}'`
            );
            return;
        }

        if (existingAccessory) {
          this.log.info(
            `Restoring existing accessory of type '${deviceContext.type}' from cache '${existingAccessory.displayName}'`
          );

          existingAccessory.context = {
            ...deviceContext
          };

          this.registeredDevices.push(
            new Accessory(device, this, existingAccessory)
          );
          return;
        }

        this.log.info(
          `Adding new accessory of type '${deviceContext.type}' for '${deviceContext.ip}'`
        );
        const accessory = new this.api.platformAccessory<DeviceContext>(
          deviceContext.type,
          deviceContext.uuid
        );
        accessory.context = {
          ...deviceContext
        };

        this.registeredDevices.push(new Accessory(device, this, accessory));
        return this.api.registerPlatformAccessories(
          PLUGIN_NAME,
          PLATFORM_NAME,
          [accessory]
        );
      } catch (error: any) {
        this.log.error(
          `Error for device (type: '${deviceContext.type}', hostname: '${deviceContext.ip}', uuid: '${deviceContext.uuid}') | ${error?.message}`
        );
        return null;
      }
    });
  }

  private checkOldDevices() {
    Platform.lock.acquire(Platform.LOCK_NAME, async () => {
      await delay(100);
      this.cachedAccessories = this.cachedAccessories
        .map((accessory) => {
          try {
            const devices = (
              (this.config?.devices as DeviceConfigSchema[]) ?? []
            ).map((device) => this.api.hap.uuid.generate(device.ip));
            const exists = devices.find((device) => device === accessory.UUID);

            if (!exists) {
              this.log.info('Remove cached accessory:', accessory.displayName);
              this.api.unregisterPlatformAccessories(
                PLUGIN_NAME,
                PLATFORM_NAME,
                [accessory]
              );

              return null;
            }

            return accessory;
          } catch (error: any) {
            this.log.error(
              `Error for device: ${accessory.displayName} | ${error?.message}`
            );

            return accessory;
          }
        })
        .filter((item) => item) as DevicePlatformAccessory[];
      await delay(100);
    });
  }
}
