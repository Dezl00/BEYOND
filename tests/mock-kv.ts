export const database=new Map<string,any>();
export async function get<T>(key:IDBValidKey){return database.get(String(key)) as T|undefined;}
export async function set(key:IDBValidKey,value:unknown){database.set(String(key),value);}
export async function del(key:IDBValidKey){database.delete(String(key));}
export async function keys(){return [...database.keys()];}
