import { Service } from 'homebridge';

import Platform, { DevicePlatformAccessory } from '../../platform';
import Accessory from '../../types/Accessory';

/**
 * This is a minimal example of Apple's new NFC Card service (part of HAP-NodeJS).
 * But because of lack of documentation, can't really do much...
 */
export default class NFCDoorAccessory implements Accessory {
  private get Characteristic() {
    return this.platform.Characteristic;
  }

  private lockManagementService?: Service;
  private lockMechanismService?: Service;
  private nfcService?: Service;

  public get UUID(): string {
    return this.accessory.context.uuid;
  }

  public handleData(): void {
    //
  }

  constructor(
    private readonly platform: Platform,
    private readonly accessory: DevicePlatformAccessory
  ) {
    console.log(`Initializing NFC Door`);
    try {
      this.accessory
        .getService(this.platform.Service.AccessoryInformation)!
        .setCharacteristic(this.Characteristic.Manufacturer, 'DEMO')
        .setCharacteristic(this.Characteristic.Model, 'DEMO')
        .setCharacteristic(this.Characteristic.SerialNumber, 'DEMO');

      this.lockManagementService =
        this.accessory.getService(this.platform.Service.LockManagement) ||
        this.accessory.addService(this.platform.Service.LockManagement);

      this.lockMechanismService =
        this.accessory.getService(this.platform.Service.LockMechanism) ||
        this.accessory.addService(this.platform.Service.LockMechanism);

      this.nfcService =
        this.accessory.getService(this.platform.Service.NFCAccess) ||
        this.accessory.addService(this.platform.Service.NFCAccess);

      // nfcService

      this.nfcService
        .getCharacteristic(this.Characteristic.NFCAccessSupportedConfiguration)
        .onGet(() => {
          console.log('Queried NFCAccessSupportedConfiguration: %o', conf);
          return 'AQEQAgEQ';
        });

      this.nfcService
        .getCharacteristic(this.Characteristic.ConfigurationState)
        .onGet(() => {
          console.log('Queried config state');
          return 0;
        });

      let conf = 'AQEQAgEQ';

      this.nfcService
        .getCharacteristic(this.Characteristic.NFCAccessControlPoint)
        .onSet((value) => {
          console.log('Control Point Write: %o', value);
          conf = value.toString();
        })
        .onGet(() => {
          console.log('Control Point Read');
          return conf;
        });

      // lockMechanismService

      let lockState = this.Characteristic.LockCurrentState.UNSECURED;

      const cSate = this.lockMechanismService
        .getCharacteristic(this.Characteristic.LockCurrentState)
        .onGet(() => {
          console.log('Queried lock state: %o', lockState);
          return lockState;
        });

      this.lockMechanismService
        .getCharacteristic(this.Characteristic.LockTargetState)
        .onSet((value) => {
          console.log('Setting lock state to: ' + value);
          lockState = parseInt(value.toString(), 10);
          setTimeout(() => {
            cSate.updateValue(lockState);
          }, 1000);
        });

      // lockManagementService

      this.lockManagementService
        .getCharacteristic(this.Characteristic.LockControlPoint)
        .onSet((value) => {
          console.log('Setting lock control point to: ' + value);
        });

      this.lockManagementService
        .getCharacteristic(this.Characteristic.Version)
        .onGet(() => {
          console.log('Query lock management version');
          return 'lk-1.0';
        });
    } catch (error: any) {
      platform.log.error(`Error: ${error?.message}`);
    }
  }
}
