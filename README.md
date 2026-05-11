# Chrome_Plugin_Data_Pipeline

Chrome_Plugin_Data_Pipeline is an automated data ingestion and processing system built with Node.js. It processes JSON data generated from Chrome plugin scrapers, retrieves files from AWS S3, validates and classifies the data, and stores structured records into MongoDB collections.

The pipeline supports multiple data sources such as LinkedIn, Lusha, BuiltWith, Tracxn, BBB, StackCrawler, Ful.io, and more for scalable company intelligence and lead enrichment workflows.

## Features

* Automated S3 file processing
* MongoDB data ingestion pipeline
* JSON validation & classification
* Dynamic collection routing
* AWS S3 file management
* Automatic processed/skipped file handling
* Domain validation
* Continuous scheduled processing
* Multi-source data support
* Duplicate-safe MongoDB upserts

## Tech Stack

* Node.js
* AWS SDK (S3)
* MongoDB
* JSON Processing

## Supported Sources

* LinkedIn
* Lusha
* BuiltWith
* Tracxn
* BBB
* StackCrawler
* Ful.io
* CRFT

## Workflow

1. Fetch JSON files from AWS S3
2. Validate and parse data
3. Detect source and profile type
4. Route data to correct MongoDB collections
5. Store structured records
6. Rename processed/skipped files in S3
7. Run continuously on scheduled intervals

## Scalability

The system supports:

* Continuous background processing
* Large-scale S3 ingestion
* Fault-tolerant processing
* Automated file lifecycle management
* Scalable MongoDB storage

Ideal for browser automation pipelines, lead enrichment systems, company intelligence platforms, and large-scale web scraping workflows.
