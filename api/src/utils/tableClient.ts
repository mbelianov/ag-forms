/**
 * Table Storage Client Wrapper
 * Provides helper methods for Azure Table Storage operations
 */

import { TableClient, TableServiceClient, odata } from "@azure/data-tables";
import { BaseEntity } from "../types";

/**
 * Get connection string from environment or use local development storage
 */
const getConnectionString = (): string => {
    return process.env.AZURE_STORAGE_CONNECTION_STRING || 'UseDevelopmentStorage=true';
};

/**
 * Initialize Table Service Client
 */
let tableServiceClient: TableServiceClient | null = null;

export const getTableServiceClient = (): TableServiceClient => {
    if (!tableServiceClient) {
        const connectionString = getConnectionString();
        tableServiceClient = TableServiceClient.fromConnectionString(connectionString);
    }
    return tableServiceClient;
};

/**
 * Get a TableClient for a specific table
 * @param tableName - Name of the table
 * @returns TableClient instance
 */
export const getTableClient = (tableName: string): TableClient => {
    const connectionString = getConnectionString();
    return TableClient.fromConnectionString(connectionString, tableName);
};

/**
 * Ensure a table exists, create it if it doesn't
 * @param tableName - Name of the table to create
 * @returns Promise<void>
 */
export const ensureTableExists = async (tableName: string): Promise<void> => {
    try {
        const serviceClient = getTableServiceClient();
        await serviceClient.createTable(tableName);
    } catch (error: any) {
        // Ignore error if table already exists (409 conflict)
        if (error.statusCode !== 409) {
            throw error;
        }
    }
};

/**
 * Query entities from a table with optional filters
 * @param tableName - Name of the table
 * @param partitionKey - Partition key to filter by
 * @param rowKeyPrefix - Optional row key prefix for filtering
 * @returns Promise<T[]> - Array of entities
 */
export const queryEntities = async <T extends BaseEntity>(
    tableName: string,
    partitionKey: string,
    rowKeyPrefix?: string
): Promise<T[]> => {
    const tableClient = getTableClient(tableName);
    const entities: T[] = [];

    try {
        let filter = `PartitionKey eq '${partitionKey}'`;
        
        if (rowKeyPrefix) {
            // Add row key prefix filter for range queries.
            // \uFFFF is the highest BMP code point and sorts after every Unicode
            // character (including Cyrillic), making this range correct for any
            // script.  The old ASCII sentinel "~" (U+007E) sorted below all
            // Cyrillic letters, causing Cyrillic-name searches to return zero rows.
            filter += ` and RowKey ge '${rowKeyPrefix}' and RowKey lt '${rowKeyPrefix}\uFFFF'`;
        }

        const entitiesIter = tableClient.listEntities<T>({
            queryOptions: { filter }
        });

        for await (const entity of entitiesIter) {
            entities.push(entity as T);
        }

        return entities;
    } catch (error: any) {
        throw new Error(`Failed to query entities from ${tableName}: ${error.message}`);
    }
};

/**
 * Get a single entity by partition key and row key
 * @param tableName - Name of the table
 * @param partitionKey - Partition key
 * @param rowKey - Row key
 * @returns Promise<T | null> - Entity or null if not found
 */
export const getEntity = async <T extends BaseEntity>(
    tableName: string,
    partitionKey: string,
    rowKey: string
): Promise<T | null> => {
    const tableClient = getTableClient(tableName);

    try {
        const entity = await tableClient.getEntity<T>(partitionKey, rowKey);
        return entity as T;
    } catch (error: any) {
        // Return null if entity not found (404)
        if (error.statusCode === 404) {
            return null;
        }
        throw new Error(`Failed to get entity from ${tableName}: ${error.message}`);
    }
};

/**
 * Insert or update an entity (upsert)
 * @param tableName - Name of the table
 * @param entity - Entity to upsert
 * @returns Promise<void>
 */
export const upsertEntity = async (
    tableName: string,
    entity: BaseEntity
): Promise<void> => {
    const tableClient = getTableClient(tableName);

    try {
        await tableClient.upsertEntity(entity, "Merge");
    } catch (error: any) {
        throw new Error(`Failed to upsert entity in ${tableName}: ${error.message}`);
    }
};

/**
 * Create a new entity
 * @param tableName - Name of the table
 * @param entity - Entity to create
 * @returns Promise<void>
 */
export const createEntity = async (
    tableName: string,
    entity: BaseEntity
): Promise<void> => {
    const tableClient = getTableClient(tableName);

    try {
        await tableClient.createEntity(entity);
    } catch (error: any) {
        if (error.statusCode === 409) {
            throw new Error(`Entity already exists in ${tableName}`);
        }
        throw new Error(`Failed to create entity in ${tableName}: ${error.message}`);
    }
};

/**
 * Update an existing entity with optimistic concurrency
 * @param tableName - Name of the table
 * @param entity - Entity to update (must include etag)
 * @returns Promise<void>
 */
export const updateEntity = async (
    tableName: string,
    entity: BaseEntity
): Promise<void> => {
    const tableClient = getTableClient(tableName);

    try {
        if (!entity.etag) {
            throw new Error('Entity must have an etag for optimistic concurrency');
        }

        await tableClient.updateEntity(entity, "Merge", { etag: entity.etag });
    } catch (error: any) {
        if (error.statusCode === 412) {
            throw new Error(`Concurrency conflict: Entity was modified by another process`);
        }
        throw new Error(`Failed to update entity in ${tableName}: ${error.message}`);
    }
};

/**
 * Delete an entity with optimistic concurrency
 * @param tableName - Name of the table
 * @param partitionKey - Partition key
 * @param rowKey - Row key
 * @param etag - ETag for optimistic concurrency (optional, use "*" to force delete)
 * @returns Promise<void>
 */
export const deleteEntity = async (
    tableName: string,
    partitionKey: string,
    rowKey: string,
    etag?: string
): Promise<void> => {
    const tableClient = getTableClient(tableName);

    try {
        await tableClient.deleteEntity(partitionKey, rowKey, { etag: etag || "*" });
    } catch (error: any) {
        if (error.statusCode === 404) {
            throw new Error(`Entity not found in ${tableName}`);
        }
        if (error.statusCode === 412) {
            throw new Error(`Concurrency conflict: Entity was modified by another process`);
        }
        throw new Error(`Failed to delete entity from ${tableName}: ${error.message}`);
    }
};

/**
 * Soft delete an entity by setting isDeleted flag
 * @param tableName - Name of the table
 * @param partitionKey - Partition key
 * @param rowKey - Row key
 * @returns Promise<void>
 */
export const softDeleteEntity = async (
    tableName: string,
    partitionKey: string,
    rowKey: string
): Promise<void> => {
    try {
        const entity = await getEntity(tableName, partitionKey, rowKey);
        
        if (!entity) {
            throw new Error(`Entity not found in ${tableName}`);
        }

        // Set soft delete flags
        (entity as any).isDeleted = true;
        (entity as any).deletedAt = new Date().toISOString();

        await updateEntity(tableName, entity);
    } catch (error: any) {
        throw new Error(`Failed to soft delete entity from ${tableName}: ${error.message}`);
    }
};

// Made with Bob
