import {
  CharacteristicGetHandler,
  CharacteristicSetHandler,
  CharacteristicValue,
  Nullable
} from 'homebridge';

import { AccessoryThisType } from '..';

const characteristic: {
  get: CharacteristicGetHandler;
  set: CharacteristicSetHandler;
} & AccessoryThisType = {
  get: async function (): Promise<Nullable<CharacteristicValue>> {
    await this.requestUpdateData();
    return this.getValidValues('target', this.cachedData.winter);
  },
  set: async function (value: CharacteristicValue) {
    await this.update({ winter: parseInt(value.toString(), 10) > 0 });
  }
};

export default characteristic;
