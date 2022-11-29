## PicoW Bridge

[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)

This is a bridge for the RPi PicoW firmware that i made at [https://github.com/RaresAil/pico-w-template](https://github.com/RaresAil/pico-w-template) in order to build custom IoT Devices, the board currently has the following services.

For more info check the other repo.

### Services

- Thermostat
- Adjustable Desk (Shown as Window Covering)

### Config example

```json
{
  "platforms": [
    {
      "platform": "RPiPicoWBridge",
      "name": "PicoW Bridge",
      "enableDebugMode": false,
      "devices": [
        {
          "ip": "192.168.x.x",
          "secret": "..."
        }
      ]
    }
  ]
}
```
