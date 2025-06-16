export const safeDestroy = async (dataSource: any) => {
    try {
      if (dataSource && dataSource.isInitialized) {
        await dataSource.destroy();
      }
    } catch (error) {
      console.error('Error during dataSource destruction:', error);
    }
  };
  
  export const safeClose = async (app: any) => {
    try {
      if (app) {
        await app.close();
      }
    } catch (error) {
      console.error('Error during app closure:', error);
    }
  };