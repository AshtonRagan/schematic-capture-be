const cleaner = require("knex-cleaner");

exports.seed = function(knex) {
    const options = {
        mode: "delete",
        restartIdentity: true,
        ignoreTables: ["knex_migrations", "knex_migrations_lock"]
    };

    return cleaner.clean(knex, options);
};
