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
    return this.cachedData.target_temperature;
  },
  set: async function (value: CharacteristicValue) {
    await this.update({ target_temperature: parseFloat(value.toString()) });
  }
};

export default characteristic;
