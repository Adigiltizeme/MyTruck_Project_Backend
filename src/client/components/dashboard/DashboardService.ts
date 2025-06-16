import axios from 'axios';
import { Delivery, DeliveryData, DeliveryMetrics, DriverStats } from './types';

export class DashboardService {
    private static baseUrl = '/api/dashboard';

    static async getMetrics(): Promise<DeliveryMetrics> {
        const response = await axios.get(`${this.baseUrl}/metrics`);
        return response.data;
    }

    static async getDeliveries(): Promise<Delivery[]> {
        const response = await axios.get(`${this.baseUrl}/deliveries`);
        return response.data;
    }

    static async getDriverStats(): Promise<DriverStats[]> {
        const response = await axios.get(`${this.baseUrl}/driver-stats`);
        return response.data;
    }

    static async getDeliveryData(): Promise<DeliveryData[]> {
        const response = await axios.get(`${this.baseUrl}/delivery-data`);
        return response.data;
    }
}