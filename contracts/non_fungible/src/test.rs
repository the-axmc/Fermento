#![cfg(test)]

extern crate std;

use soroban_sdk::{ testutils::Address as _, Address, Env, String };

use crate::contract::{ GrapeFermenter, GrapeFermenterClient };

#[test]
fn initial_state() {
    let env = Env::default();

    let contract_addr = env.register(GrapeFermenter, (Address::generate(&env),Address::generate(&env),Address::generate(&env),Address::generate(&env)));
    let client = GrapeFermenterClient::new(&env, &contract_addr);

    assert_eq!(client.name(), String::from_str(&env, "GrapeFermenter"));
}

// Add more tests bellow
