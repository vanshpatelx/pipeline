use actix_web::{web, App, HttpResponse, HttpServer, Responder};
use serde::{Deserialize, Serialize};

// Define a struct for the POST data
#[derive(Deserialize, Serialize)]
struct Person {
    name: String,
    age: u32,
}

// Sample GET endpoint
async fn greet() -> impl Responder {
    HttpResponse::Ok().body("Hello, Rust with Actix-web!")
}

// Sample POST endpoint
async fn create_person(person: web::Json<Person>) -> impl Responder {
    let message = format!("Hello {}, you are {} years old.", person.name, person.age);
    HttpResponse::Ok().json(serde_json::json!({ "message": message }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    HttpServer::new(|| {
        App::new()
            .route("/", web::get().to(greet))
            .route("/data", web::post().to(create_person))
    })
    .bind("127.0.0.1:8080")?
    .run()
    .await
}