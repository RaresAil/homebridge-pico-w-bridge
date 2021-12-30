import { Characteristic, Service } from 'homebridge';
import { randomBytes } from 'crypto';
import AsyncLock from 'async-lock';

import CurrentHeatingCoolingState from './characteristics/CurrentHeatingCoolingState';
import TargetHeatingCoolingState from './characteristics/TargetHeatingCoolingState';
import TemperatureDisplayUnits from './characteristics/TemperatureDisplayUnits';
import CurrentTemperature from './characteristics/CurrentTemperature';
import TargetTemperature from './characteristics/TargetTemperature';
import CurrentHumidity from './characteristics/CurrentHumidity';

import Platform, { DevicePlatformAccessory } from '../../platform';
import { PACKET_TYPE } from '../../types/Device';
import { PLUGIN_VERSION } from '../../settings';
import Accessory from '../../types/Accessory';
import Device from '../../api/Device';

export type AccessoryThisType = ThisType<{
  update(data: Partial<ThermostatData>): Promise<void>;
  requestUpdateData(): Promise<void>;
  readonly platform: Platform;
  thermostatService: Service;
  cachedData: ThermostatData;
  infoService: Service;
  getValidValues(
    forChar: 'target' | 'current' | 'unit',
    input: boolean
  ): number;
}>;

export interface ThermostatData {
  readonly temperature: number;
  target_temperature: number;
  readonly humidity: number;
  heating: boolean;
  celsius: boolean;
  winter: boolean;
}

export default class ThermostatAccessory implements Accessory {
  private readonly lock = new AsyncLock();

  private currentHeatingCoolingState?: Characteristic;
  private targetHeatingCoolingState?: Characteristic;
  private temperatureDisplayUnits?: Characteristic;
  private currentTemperature?: Characteristic;
  private targetTemperature?: Characteristic;
  private currentHumidity?: Characteristic;

  private thermostatService?: Service;
  private _cachedData: ThermostatData = {
    target_temperature: 10,
    temperature: 0,
    heating: false,
    winter: false,
    celsius: true,
    humidity: 0
  };

  public get cachedData(): ThermostatData {
    const { temperature, target_temperature, humidity, ...data } =
      this._cachedData;
    return {
      ...data,
      target_temperature:
        target_temperature < 10
          ? 10
          : target_temperature > 38
          ? 38
          : target_temperature,
      temperature:
        temperature < -270 ? -270 : temperature > 100 ? 100 : temperature,
      humidity: humidity < 0 ? 0 : humidity > 100 ? 100 : humidity
    };
  }

  public get UUID(): string {
    return this.accessory.context.uuid;
  }

  private handleData(data: ThermostatData): void {
    this._cachedData = data;

    this.targetTemperature?.updateValue(this.cachedData.target_temperature);
    this.currentHeatingCoolingState?.updateValue(
      this.getValidValues('current', this.cachedData.heating)
    );
    this.targetHeatingCoolingState?.updateValue(
      this.getValidValues('target', this.cachedData.winter)
    );
    this.currentTemperature?.updateValue(this.cachedData.temperature);
    this.currentHumidity?.updateValue(this.cachedData.humidity);
    this.temperatureDisplayUnits?.updateValue(
      this.getValidValues('unit', this.cachedData.celsius)
    );
  }

  constructor(
    private readonly device: Device,
    private readonly platform: Platform,
    private readonly accessory: DevicePlatformAccessory
  ) {
    try {
      this.device.eventHandler.on('data', this.handleData.bind(this));

      this.accessory
        .getService(this.platform.Service.AccessoryInformation)!
        .setCharacteristic(
          this.platform.Characteristic.Manufacturer,
          'Raspberry Pi'
        )
        .setCharacteristic(
          this.platform.Characteristic.Model,
          this.accessory.context.type
        )
        .setCharacteristic(
          this.platform.Characteristic.SerialNumber,
          this.accessory.context.uuid
        )
        .setCharacteristic(
          this.platform.Characteristic.FirmwareRevision,
          `${PLUGIN_VERSION}-${this.accessory.context.info.firmware_version}`
        );

      this.thermostatService =
        this.accessory.getService(this.platform.Service.Thermostat) ||
        this.accessory.addService(this.platform.Service.Thermostat);

      // Characteristics
      this.currentHeatingCoolingState = this.thermostatService
        .getCharacteristic(
          this.platform.Characteristic.CurrentHeatingCoolingState
        )
        .onGet(CurrentHeatingCoolingState.get.bind(this))
        .setProps({
          validValues: [
            this.platform.Characteristic.CurrentHeatingCoolingState.OFF,
            this.platform.Characteristic.CurrentHeatingCoolingState.HEAT
          ]
        });

      this.targetHeatingCoolingState = this.thermostatService
        .getCharacteristic(
          this.platform.Characteristic.TargetHeatingCoolingState
        )
        .onGet(TargetHeatingCoolingState.get.bind(this))
        .onSet(TargetHeatingCoolingState.set.bind(this))
        .setProps({
          validValues: [
            this.platform.Characteristic.TargetHeatingCoolingState.OFF,
            this.platform.Characteristic.TargetHeatingCoolingState.AUTO
          ]
        });

      this.currentTemperature = this.thermostatService
        .getCharacteristic(this.platform.Characteristic.CurrentTemperature)
        .onGet(CurrentTemperature.get.bind(this));

      this.currentHumidity = this.thermostatService
        .getCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity)
        .onGet(CurrentHumidity.get.bind(this));

      this.targetTemperature = this.thermostatService
        .getCharacteristic(this.platform.Characteristic.TargetTemperature)
        .onGet(TargetTemperature.get.bind(this))
        .onSet(TargetTemperature.set.bind(this))
        .setProps({
          minStep: 0.5
        });

      this.temperatureDisplayUnits = this.thermostatService
        .getCharacteristic(this.platform.Characteristic.TemperatureDisplayUnits)
        .onGet(TemperatureDisplayUnits.get.bind(this))
        .onSet(TemperatureDisplayUnits.set.bind(this));
    } catch (error: any) {
      platform.log.error(`Error: ${error?.message}`);
    }
  }

  private update(data: Partial<ThermostatData>): Promise<void> {
    return this.lock.acquire(
      'update',
      () =>
        new Promise<void>((resolve) => {
          const cmd_id = randomBytes(12).toString('hex');
          const eventName = `data-${cmd_id}`;
          let responded = false;

          const eventCallback = (data: ThermostatData) => {
            if (responded) {
              return;
            }

            this.handleData(data);
            responded = true;
            clearTimeout(timeout);
            resolve();
          };

          const timeout = setTimeout(() => {
            if (!responded) {
              responded = true;
              this.device.eventHandler.removeListener(eventName, eventCallback);
              resolve();
            }
          }, 2000);

          this.device.eventHandler.once(eventName, eventCallback);
          this.device.sendData(
            PACKET_TYPE.SET,
            {
              ...data
            },
            cmd_id
          );
        })
    );
  }

  private receivingData = false;
  private requestUpdateData(): Promise<void> {
    return this.lock.acquire('update', async () => {
      if (!this.receivingData) {
        this.receivingData = true;
        setTimeout(() => {
          this.device.sendData(PACKET_TYPE.GET, {});
          this.receivingData = false;
        }, 750);
      }
    });
  }

  private getValidValues(
    forChar: 'target' | 'current' | 'unit',
    input: boolean
  ): number {
    switch (forChar) {
      case 'target':
        return input
          ? this.platform.Characteristic.TargetHeatingCoolingState.AUTO
          : this.platform.Characteristic.TargetHeatingCoolingState.OFF;
      case 'current':
        return input
          ? this.platform.Characteristic.CurrentHeatingCoolingState.HEAT
          : this.platform.Characteristic.CurrentHeatingCoolingState.OFF;
      case 'unit':
        return input
          ? this.platform.Characteristic.TemperatureDisplayUnits.CELSIUS
          : this.platform.Characteristic.TemperatureDisplayUnits.FAHRENHEIT;
    }
  }
}
