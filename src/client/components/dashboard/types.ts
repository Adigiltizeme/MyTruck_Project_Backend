export interface DeliveryMetrics {
    total: number;
    enCours: number;
    performance: number;
    chiffreAffaires: number;
    satisfactionClient: number;
}

export interface Delivery {
    id: string;
    store: string;
    driver: string;
    status: 'En cours' | 'En attente' | 'Terminée';
    startTime: string;
    eta: string;
    items: number;
    priority: 'Urgent' | 'Normal';
}

export interface DriverStats {
    driver: string;
    completed: number;
    onTime: number;
    satisfaction: number;
    totalHours: number;
}

export interface DeliveryData {
    date: string;
    completed: number;
    inProgress: number;
    pending: number;
    satisfaction: number;
}