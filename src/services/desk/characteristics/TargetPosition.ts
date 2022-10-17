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
    return this.cachedData.target_height;
  },
  set: async function (value: CharacteristicValue) {
    await this.update({ target_height: parseFloat(value.toString()) });
  }
};

export default characteristic;
