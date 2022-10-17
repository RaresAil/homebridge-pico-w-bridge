import { Logger } from 'homebridge';

export default class DebugMode {
  constructor(
    private readonly _debugMode: boolean,
    private readonly log: Logger
  ) {}

  public debug(...message: any[]): void {
    if (!this._debugMode) {
      return;
    }

    this.log.info(`[DEBUG]: ${message.join(' ')}`);
  }

  public errorDebug(...message: any[]): void {
    if (!this._debugMode) {
      return;
    }

    this.log.error(`[DEBUG]: ${message.join(' ')}`);
  }

  public error(...message: any[]): void {
    this.log.error(`${message.join(' ')}`);
  }
}
