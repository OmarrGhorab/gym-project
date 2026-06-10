<?php

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/*
|--------------------------------------------------------------------------
| Test Case
|--------------------------------------------------------------------------
|
| The closure you provide here is used as the base test case for all tests.
| Feature tests extend the full Laravel TestCase (HTTP, database, container).
| Unit tests extend the same base but without RefreshDatabase because they
| test logic in isolation and must not depend on the database state.
|
*/

uses(TestCase::class)->in('Feature', 'Unit');

/*
|--------------------------------------------------------------------------
| Database Refresh
|--------------------------------------------------------------------------
|
| Feature tests require a clean database on every run. SQLite in-memory is
| configured in phpunit.xml (DB_CONNECTION=sqlite, DB_DATABASE=:memory:).
| RefreshDatabase runs all migrations inside a transaction that rolls back
| after each test, keeping the suite fast.
|
*/

uses(RefreshDatabase::class)->in('Feature');
