import { AccessoryType } from './Accessory';

export enum PACKET_TYPE {
  ERROR = 'ERROR',
  PING = 'PING',
  INFO = 'INFO',
  SET = 'SET',
  GET = 'GET'
}

export interface InputPacket<T = Record<string, any>> {
  type: Omit<PACKET_TYPE, PACKET_TYPE.ERROR>;
  id?: string;
  body?: T;
}

export interface InfoPacket {
  firmware_version: string;
  serial_number: string;
  country_code: string;
  uptime: number;
  type: number;
  ssid: string;
}

export interface ResponsePacket<T> {
  client_id: string;
  type: PACKET_TYPE;
  message?: string; // For error packet
  id: string;
  data?: T;
}

export interface DeviceContext {
  type: AccessoryType;
  info: InfoPacket;
  uuid: string;
  ip: string;
}
