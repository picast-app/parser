# Parser

Parser pagination scenarios:

- is single page:

  - overwrite episode total

- is paginated:

  - has known episodes on first page:

    - add to episode total

  - has only unknown episodes on first page:

    - create temporary parsing record
    - append to parsing record
    - persist record on final page
