import fs from 'fs';

class Database {
    constructor() {
        this.data = []; // Simulate database with in-memory array
    }

    async save(rowData) {
        this.data.push(rowData);
        console.log('Saved:', rowData.title);
    }

    async exportToJSON(filename = 'data.json') {
        fs.writeFileSync(filename, JSON.stringify(this.data, null, 4));
        console.log(`Exported data to ${filename}`);
    }
}

export default new Database();