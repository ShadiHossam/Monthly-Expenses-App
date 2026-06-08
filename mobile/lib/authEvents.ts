import mitt from 'mitt';

type Events = { unauthorized: void };
export const authEmitter = mitt<Events>();
