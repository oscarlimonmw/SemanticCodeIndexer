// Example: Data repository with TypeScript
interface Repository<T> {
  findById(id: string): Promise<T | null>;
  findAll(): Promise<T[]>;
  save(entity: T): Promise<T>;
  delete(id: string): Promise<boolean>;
}

class InMemoryRepository<T extends { id: string }> implements Repository<T> {
  private data: Map<string, T>;

  constructor() {
    this.data = new Map();
  }

  async findById(id: string): Promise<T | null> {
    return this.data.get(id) || null;
  }

  async findAll(): Promise<T[]> {
    return Array.from(this.data.values());
  }

  async save(entity: T): Promise<T> {
    this.data.set(entity.id, entity);
    return entity;
  }

  async delete(id: string): Promise<boolean> {
    return this.data.delete(id);
  }

  clear(): void {
    this.data.clear();
  }
}

const createRepository = <T extends { id: string }>(): Repository<T> => {
  return new InMemoryRepository<T>();
};

export { Repository, InMemoryRepository, createRepository };
