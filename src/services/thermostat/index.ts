import { Characteristic } from 'homebridge';

import CurrentHeatingCoolingState from './characteristics/CurrentHeatingCoolingState';
import TargetHeatingCoolingState from './characteristics/TargetHeatingCoolingState';
import TemperatureDisplayUnits from './characteristics/TemperatureDisplayUnits';
import CurrentTemperature from './characteristics/CurrentTemperature';
import TargetTemperature from './characteristics/TargetTemperature';
import CurrentHumidity from './characteristics/CurrentHumidity';

import Platform, { DevicePlatformAccessory } from '../../platform';
import Accessory from '../../types/Accessory';
import Device from '../../api/Device';

export type AccessoryThisType = ThisType<{
  update(data: Partial<ThermostatData>): Promise<void>;
  requestUpdateData(): Promise<void>;
  readonly platform: Platform;
  cachedData: ThermostatData;
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

export default class ThermostatAccessory extends Accessory<ThermostatData> {
  private currentHeatingCoolingState?: Characteristic;
  private targetHeatingCoolingState?: Characteristic;
  private temperatureDisplayUnits?: Characteristic;
  private currentTemperature?: Characteristic;
  private targetTemperature?: Characteristic;
  private currentHumidity?: Characteristic;

  protected _cachedData: ThermostatData = {
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

  protected handleData(data: ThermostatData): void {
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
    device: Device,
    platform: Platform,
    accessory: DevicePlatformAccessory
  ) {
    super(device, platform, accessory);

    try {
      this.service =
        this.accessory.getService(this.platform.Service.Thermostat) ||
        this.accessory.addService(this.platform.Service.Thermostat);

      // Characteristics
      this.currentHeatingCoolingState = this.service
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

      this.targetHeatingCoolingState = this.service
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

      this.currentTemperature = this.service
        .getCharacteristic(this.platform.Characteristic.CurrentTemperature)
        .onGet(CurrentTemperature.get.bind(this));

      this.currentHumidity = this.service
        .getCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity)
        .onGet(CurrentHumidity.get.bind(this));

      this.targetTemperature = this.service
        .getCharacteristic(this.platform.Characteristic.TargetTemperature)
        .onGet(TargetTemperature.get.bind(this))
        .onSet(TargetTemperature.set.bind(this))
        .setProps({
          minStep: 0.5
        });

      this.temperatureDisplayUnits = this.service
        .getCharacteristic(this.platform.Characteristic.TemperatureDisplayUnits)
        .onGet(TemperatureDisplayUnits.get.bind(this))
        .onSet(TemperatureDisplayUnits.set.bind(this));
    } catch (error: any) {
      platform.log.error(`Error: ${error?.message}`);
    }
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
