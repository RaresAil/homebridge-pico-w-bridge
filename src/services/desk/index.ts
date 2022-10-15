import { Characteristic } from 'homebridge';

import Platform, { DevicePlatformAccessory } from '../../platform';
import Accessory from '../../types/Accessory';
import Device from '../../api/Device';

export type AccessoryThisType = ThisType<{
  update(data: Partial<DeskData>): Promise<void>;
  requestUpdateData(): Promise<void>;
  readonly platform: Platform;
  cachedData: DeskData;
}>;

export interface DeskData {
  readonly position_state: number;
  readonly current_height: number;
  target_height: number;
}

export default class DeskAccessory extends Accessory<DeskData> {
  protected _cachedData: DeskData = {
    position_state: this.platform.Characteristic.PositionState.STOPPED,
    current_height: 0,
    target_height: 0
  };

  get UUID(): string {
    return this.accessory.context.uuid;
  }

  protected handleData(data: DeskData): void {
    this._cachedData = data;

    // this.targetTemperature?.updateValue(this.cachedData.target_temperature);
    // this.currentHeatingCoolingState?.updateValue(
    //   this.getValidValues('current', this.cachedData.heating)
    // );
    // this.targetHeatingCoolingState?.updateValue(
    //   this.getValidValues('target', this.cachedData.winter)
    // );
    // this.currentTemperature?.updateValue(this.cachedData.temperature);
    // this.currentHumidity?.updateValue(this.cachedData.humidity);
    // this.temperatureDisplayUnits?.updateValue(
    //   this.getValidValues('unit', this.cachedData.celsius)
    // );
  }

  constructor(
    device: Device,
    platform: Platform,
    accessory: DevicePlatformAccessory
  ) {
    super(device, platform, accessory);

    try {
      this.service =
        this.accessory.getService(this.platform.Service.WindowCovering) ||
        this.accessory.addService(this.platform.Service.WindowCovering);

      // Characteristics
      this.service
        .getCharacteristic(this.platform.Characteristic.TargetPosition)
        .onGet(() => {
          console.log('get TargetPosition');
          return targetPosition;
        })
        .onSet((value) => {
          const st = getState(position, value as number);
          console.log('set TargetPosition %o - %o', value, st);
          targetPosition = value as number;

          state.updateValue(st);

          setTimeout(() => {
            position = targetPosition;
            console.log('UPDATE %o', value);
            pos.updateValue(targetPosition);
            state.updateValue(2);
          }, 1000);
        });

      state = this.service
        .getCharacteristic(this.platform.Characteristic.PositionState)
        .onGet(() => {
          console.log('get PositionState');

          return getState(position, targetPosition);
        });

      pos = this.service
        .getCharacteristic(this.platform.Characteristic.CurrentPosition)
        .onGet(() => {
          console.log('get CurrentPosition');
          return position;
        });
    } catch (error: any) {
      platform.log.error(`Error: ${error?.message}`);
    }
  }
}
