class ApiResponse{
    constructor(statusCode,data,message="success"){
        this.statusCode=statusCode
        this.data=data
        this.message=message
        this.success = statusCode <400; // Assuming success for status codes < 400
        
    }
}

export default ApiResponse;