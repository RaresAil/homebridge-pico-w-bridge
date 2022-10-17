import { Characteristic } from 'homebridge';

import Platform, { DevicePlatformAccessory } from '../../platform';
import Accessory from '../../types/Accessory';
import Device from '../../api/Device';

import CurrentPosition from './characteristics/CurrentPosition';
import TargetPosition from './characteristics/TargetPosition';
import PositionState from './characteristics/PositionState';

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
  private currentPosition?: Characteristic;
  private targetPosition?: Characteristic;
  private positionState?: Characteristic;

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

    this.targetPosition?.updateValue(this.cachedData.target_height);
    this.currentPosition?.updateValue(this.cachedData.current_height);
    this.positionState?.updateValue(this.cachedData.position_state);
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
      this.targetPosition = this.service
        .getCharacteristic(this.platform.Characteristic.TargetPosition)
        .onGet(TargetPosition.get.bind(this))
        .onSet(TargetPosition.set.bind(this));

      this.positionState = this.service
        .getCharacteristic(this.platform.Characteristic.PositionState)
        .onGet(PositionState.get.bind(this));

      this.currentPosition = this.service
        .getCharacteristic(this.platform.Characteristic.CurrentPosition)
        .onGet(CurrentPosition.get.bind(this));
    } catch (error: any) {
      platform.log.error(`Error: ${error?.message}`);
    }
  }
}
